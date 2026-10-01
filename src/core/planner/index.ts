import type { Condition, Depth, DevstackModule } from '../../types/module'
import type { PackageJson } from '../../types/package-json'
import type { GenerationPlan, PlannedEnvVar, PlannedFile } from '../../types/plan'
import { NODE_LANGUAGE } from '../../adapters/language/node'
import {
  packageManagerAdapter,
  type PackageManagerId as PackageManager
} from '../../adapters/package-manager/index'
import { composeModules } from '../composer'
import { MANIFEST_PATH, manifestFor } from '../manifest'
import { planCommands, type CommandOptions } from './commands'
import { collectEnv, dotEnv, envExample } from './env'
import { EXECUTABLE_MODE, generatedFile, moduleTemplateFiles } from './files'
import { conditionContextFor, evaluateCondition, includedAtDepth, moduleDepth } from './conditions'
import { formatPlannedFiles } from './format'
import { resolveModuleOptions, type ResolvedModuleOptions } from './options'
import { pnpmWorkspaceYaml } from './pnpm'
import { projectReadme } from './readme'
import { renderSlots } from './slots'
import type { TemplateContext } from './templates'

export interface PlanInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  registry: Map<string, DevstackModule>
  /** Options per module id, e.g. `{ 'security-rate-limit': { limit: 500 } }` (task 1.6). */
  moduleOptions?: Readonly<Record<string, unknown>>
  packageManager: PackageManager
  /** `bare` (config and tooling) or `wired` (default, adds integration code). */
  depth?: Depth
  options: CommandOptions
}

const plannedDepth = (input: PlanInput): Depth => input.depth ?? 'wired'

/** Modules whose files, slots and env appear at this depth (task 1.9). */
function modulesAtDepth(modules: readonly DevstackModule[], depth: Depth): DevstackModule[] {
  return modules.filter((moduleDefinition) => includedAtDepth(moduleDepth(moduleDefinition), depth))
}

/** Files generation adds to when they exist (task 1.3), e.g. generating into an existing repo. */
const MERGE_STRATEGIES: Readonly<Record<string, PlannedFile['strategy']>> = {
  'package.json': 'json-merge',
  '.gitignore': 'line-merge',
  '.dockerignore': 'line-merge'
}

/** Whether a file, slot fragment or script rule of a module applies to this stack and depth. */
function ruleIncluded(
  modules: readonly DevstackModule[],
  moduleDefinition: DevstackModule,
  rule: { depth?: Depth; when?: Condition } | undefined,
  moduleOptions: ResolvedModuleOptions,
  depth: Depth
): boolean {
  if (!includedAtDepth(rule?.depth ?? moduleDepth(moduleDefinition), depth)) return false
  if (rule?.when === undefined) return true
  const context = conditionContextFor(modules, moduleOptions[moduleDefinition.id] ?? {}, depth)
  return evaluateCondition(rule.when, context)
}

/** Adds each module's conditional scripts (`ScriptRule`) that apply to this stack. */
function withScriptRules(
  packageJson: PackageJson,
  modules: readonly DevstackModule[],
  moduleOptions: ResolvedModuleOptions,
  depth: Depth
): PackageJson {
  const extra = modules.flatMap((moduleDefinition) =>
    (moduleDefinition.scripts ?? [])
      .filter((rule) => ruleIncluded(modules, moduleDefinition, rule, moduleOptions, depth))
      .map((rule): [string, string] => [rule.name, rule.run])
  )
  if (extra.length === 0) return packageJson
  return { ...packageJson, scripts: { ...packageJson.scripts, ...Object.fromEntries(extra) } }
}

function has(modules: readonly DevstackModule[], id: string): boolean {
  return modules.some((moduleDefinition) => moduleDefinition.id === id)
}

function lintStagedConfig(modules: readonly DevstackModule[]): Record<string, string[]> {
  const config: Record<string, string[]> = {}
  if (has(modules, 'quality-prettier')) {
    config['*.{js,ts,tsx,jsx,json,md,yml,yaml}'] = ['prettier --write']
  }
  if (has(modules, 'quality-eslint')) {
    config['src/**/*.ts'] = ['eslint --fix']
    config['tests/**/*.ts'] = ['eslint --fix']
  }
  return config
}

function huskyFiles(
  modules: readonly DevstackModule[],
  packageManager: PackageManager
): PlannedFile[] {
  const pm = packageManagerAdapter(packageManager)
  const lintStaged = pm.hookCommand('lint-staged')
  const commitlint = `${pm.hookCommand('commitlint')} --edit "$1"`
  return [
    generatedFile(
      'commitlint.config.cjs',
      "module.exports = { extends: ['@commitlint/config-conventional'] }\n",
      { strategy: 'skip-if-exists' }
    ),
    generatedFile('.lintstagedrc.json', `${JSON.stringify(lintStagedConfig(modules))}\n`, {
      strategy: 'skip-if-exists'
    }),
    generatedFile('.husky/pre-commit', `#!/usr/bin/env sh\n${lintStaged}\n`, {
      mode: EXECUTABLE_MODE
    }),
    generatedFile('.husky/commit-msg', `#!/usr/bin/env sh\n${commitlint}\n`, {
      mode: EXECUTABLE_MODE
    })
  ]
}

/** Files DevStack writes itself rather than from module templates. */
function generatedFiles(
  input: PlanInput,
  modules: readonly DevstackModule[],
  packageJson: PackageJson,
  buildApprovals: readonly string[],
  moduleOptions: ResolvedModuleOptions,
  env: readonly PlannedEnvVar[]
): PlannedFile[] {
  const manifest = manifestFor({
    projectName: input.projectName,
    packageManager: input.packageManager,
    modules: modules.map((moduleDefinition) => moduleDefinition.id),
    options: moduleOptions,
    depth: plannedDepth(input)
  })
  return [
    generatedFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`),
    generatedFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`),
    generatedFile(
      'README.md',
      projectReadme({
        projectName: input.projectName,
        packageManager: input.packageManager,
        modules,
        packageJson,
        env
      }),
      { strategy: 'skip-if-exists' }
    ),
    ...(env.length === 0
      ? []
      : [
          generatedFile('.env.example', envExample(env)),
          // local values only; an existing .env holds the developer's own settings
          generatedFile('.env', dotEnv(env), { strategy: 'skip-if-exists' })
        ]),
    ...(has(modules, 'quality-husky') ? huskyFiles(modules, input.packageManager) : []),
    ...(input.packageManager === 'pnpm' && buildApprovals.length > 0
      ? [
          generatedFile('pnpm-workspace.yaml', pnpmWorkspaceYaml(buildApprovals), {
            strategy: 'skip-if-exists'
          })
        ]
      : [])
  ]
}

async function collectFiles(
  input: PlanInput,
  modules: readonly DevstackModule[],
  packageJson: PackageJson,
  buildApprovals: readonly string[],
  moduleOptions: ResolvedModuleOptions
): Promise<PlannedFile[]> {
  const depth = plannedDepth(input)
  const env = collectEnv(modulesAtDepth(modules, depth))
  const context: Omit<TemplateContext, 'options'> = {
    projectName: input.projectName,
    packageManager: input.packageManager,
    pm: packageManagerAdapter(input.packageManager).docker,
    language: NODE_LANGUAGE,
    modules: modules.map((moduleDefinition) => moduleDefinition.id),
    env,
    slots: renderSlots(modules, (moduleDefinition, fragment) =>
      ruleIncluded(modules, moduleDefinition, fragment, moduleOptions, depth)
    )
  }

  const files = new Map<string, PlannedFile>()
  const add = (file: PlannedFile): void => {
    files.set(file.path, file) // later contributions replace earlier ones
  }
  for (const file of generatedFiles(
    input,
    modules,
    packageJson,
    buildApprovals,
    moduleOptions,
    env
  )) {
    add(file)
  }
  for (const moduleDefinition of modules) {
    const include = (outputPath: string): boolean =>
      ruleIncluded(
        modules,
        moduleDefinition,
        moduleDefinition.files?.find((rule) => rule.path === outputPath),
        moduleOptions,
        depth
      )
    for (const file of await moduleTemplateFiles(
      moduleDefinition,
      context,
      moduleOptions[moduleDefinition.id],
      include
    ))
      add(file)
  }
  return [...files.values()]
    .map((file) => {
      const strategy = MERGE_STRATEGIES[file.path]
      return strategy === undefined ? file : { ...file, strategy }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Resolves the stack and describes everything generation will write and run (buildPlan B3). */
export async function buildGenerationPlan(input: PlanInput): Promise<GenerationPlan> {
  const composition = composeModules(input.selectedModuleNames, input.registry, input.projectName)
  const modules = composition.orderedModules
  const moduleOptions = resolveModuleOptions(modules, input.moduleOptions ?? {})
  const files = await collectFiles(
    input,
    modules,
    withScriptRules(composition.packageJson, modules, moduleOptions, plannedDepth(input)),
    composition.buildApprovals,
    moduleOptions
  )

  return {
    projectName: input.projectName,
    projectDir: input.projectDir,
    packageManager: input.packageManager,
    modules: modules.map((moduleDefinition) => moduleDefinition.id),
    files: await formatPlannedFiles(files),
    commands: planCommands(modules, input.packageManager, input.options),
    env: collectEnv(modulesAtDepth(modules, plannedDepth(input))),
    depth: plannedDepth(input)
  }
}
