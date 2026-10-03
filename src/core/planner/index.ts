import path from 'node:path'

import type { Condition, Depth, DevstackModule } from '../../types/module'
import type { PackageJson } from '../../types/package-json'
import type { GenerationPlan, PlannedEnvVar, PlannedFile } from '../../types/plan'
import { NODE_LANGUAGE } from '../../adapters/language/node'
import { NODE_CATALOG } from '../../catalog/node'
import {
  packageManagerAdapter,
  type PackageManagerId as PackageManager
} from '../../adapters/package-manager/index'
import { composeModules, composeProjectPackageJson } from '../composer'
import { MANIFEST_PATH, manifestFor } from '../manifest'
import { planCommands, type CommandOptions } from './commands'
import { collectEnv, dotEnv, envExample } from './env'
import { agentsMd, CLAUDE_MD } from './agents-md'
import { generatedFile, moduleTemplateFiles, resolvePathTokens } from './files'
import { has, huskyFiles } from './husky'
import { conditionContextFor, evaluateCondition, includedAtDepth, moduleDepth } from './conditions'
import { formatPlannedFiles } from './format'
import { resolveModuleOptions, type ResolvedModuleOptions } from './options'
import { pnpmWorkspaceYaml } from './pnpm'
import { projectReadme } from './readme'
import { renderSlots } from './slots'
import {
  envForTarget,
  inTarget,
  isMonorepo,
  MONOREPO_PORTS,
  planTargets,
  portOf,
  type Target,
  WEB_ROLES,
  workspaceRange
} from './targets'
import type { TemplateContext } from './templates'

export interface PlanInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  registry: Map<string, DevstackModule>
  /** Options per module id, e.g. `{ 'security-rate-limit': { limit: 500 } }` (task 1.6). */
  moduleOptions?: Readonly<Record<string, unknown>>
  packageManager: PackageManager
  /** Installed version of the package manager, for the monorepo's `packageManager` field. */
  packageManagerVersion?: string
  /** `bare` (config and tooling) or `wired` (default, adds integration code). */
  depth?: Depth
  options: CommandOptions
  /** Source of generated local secrets (B17.7); random unless a test pins it. */
  secret?: () => string
}

const plannedDepth = (input: PlanInput): Depth => input.depth ?? 'wired'

/** Modules whose files, slots and env appear at this depth (task 1.9). */
function modulesAtDepth(modules: readonly DevstackModule[], depth: Depth): DevstackModule[] {
  return modules.filter((moduleDefinition) => includedAtDepth(moduleDepth(moduleDefinition), depth))
}

/** Files (by name, in any target) generation adds to when they exist (task 1.3). */
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
  depth: Depth,
  target?: string
): boolean {
  if (!includedAtDepth(rule?.depth ?? moduleDepth(moduleDefinition), depth)) return false
  if (rule?.when === undefined) return true
  const context = conditionContextFor(modules, moduleOptions[moduleDefinition.id] ?? {}, depth)
  return evaluateCondition(rule.when, { ...context, target })
}

/** Adds each target module's conditional scripts (`ScriptRule`) that apply to this stack. */
function withScriptRules(
  packageJson: PackageJson,
  modules: readonly DevstackModule[],
  targetModules: readonly DevstackModule[],
  moduleOptions: ResolvedModuleOptions,
  depth: Depth
): PackageJson {
  const extra = targetModules.flatMap((moduleDefinition) =>
    (moduleDefinition.scripts ?? [])
      .filter((rule) => ruleIncluded(modules, moduleDefinition, rule, moduleOptions, depth))
      .map((rule): [string, string] => [rule.name, rule.run])
  )
  if (extra.length === 0) return packageJson
  return { ...packageJson, scripts: { ...packageJson.scripts, ...Object.fromEntries(extra) } }
}

/** Scripts may say `{{port}}`, e.g. `next dev --port {{port}}`: each app fills in its own (D-30). */
function withPorts(packageJson: PackageJson, port: number): PackageJson {
  if (packageJson.scripts === undefined) return packageJson
  const scripts = Object.fromEntries(
    Object.entries(packageJson.scripts).map(([name, run]) => [
      name,
      run.replaceAll('{{port}}', String(port))
    ])
  )
  return { ...packageJson, scripts }
}

/** Fallback when the installed version is unknown (dry runs); a real run passes the probed one. */
const FALLBACK_PM_VERSIONS: Readonly<Record<PackageManager, string>> = {
  npm: '11.6.2',
  pnpm: '10.18.0',
  yarn: '1.22.22',
  bun: '1.3.0'
}

const WORKSPACE_GLOBS = ['apps/*', 'packages/*']

/** A target's package.json: its modules' fragments and dependencies, plus workspace fields at the root. */
function targetPackageJson(input: PlanInput, target: Target, context: PlanContext): PackageJson {
  const composed = withPorts(
    withScriptRules(
      composeProjectPackageJson(target.packageName, target.modules, context.modules),
      context.modules,
      target.modules,
      context.moduleOptions,
      context.depth
    ),
    portOf(target.role, context.monorepo)
  )
  if (!context.monorepo) return composed
  const shared = context.targets.find((candidate) => candidate.role === 'shared')
  if (WEB_ROLES.includes(target.role) && shared !== undefined) {
    return {
      ...composed,
      dependencies: {
        ...composed.dependencies,
        [shared.packageName]: workspaceRange(input.packageManager)
      }
    }
  }
  if (target.role !== 'root') return composed
  const version = input.packageManagerVersion ?? FALLBACK_PM_VERSIONS[input.packageManager]
  return {
    ...composed,
    packageManager: `${input.packageManager}@${version}`,
    workspaces: WORKSPACE_GLOBS,
    // the one place the ports are recorded (D-30); both apps' .env defaults use the same values
    devstack: {
      ports: { web: MONOREPO_PORTS.frontend ?? 3000, api: MONOREPO_PORTS.backend ?? 3001 }
    }
  }
}

interface PlanContext {
  targets: readonly Target[]
  modules: readonly DevstackModule[]
  moduleOptions: ResolvedModuleOptions
  depth: Depth
  monorepo: boolean
  /** `features` with feature-scoped architecture, else `modules` (B17.6). */
  domainsDir: string
  slots: Record<string, string>
}

interface TargetOutput {
  files: PlannedFile[]
  env: PlannedEnvVar[]
  packageJson: PackageJson
}

/** One target's files: its manifest, env files and its modules' templates, under its directory. */
async function targetOutput(
  input: PlanInput,
  target: Target,
  context: PlanContext
): Promise<TargetOutput> {
  const env = envForTarget(
    target,
    collectEnv(modulesAtDepth(target.modules, context.depth), (moduleDefinition, declaration) =>
      ruleIncluded(
        context.modules,
        moduleDefinition,
        { when: declaration.when },
        context.moduleOptions,
        context.depth,
        target.role
      )
    ),
    context.targets
  )
  const packageJson = targetPackageJson(input, target, context)
  const templateContext: Omit<TemplateContext, 'options'> = {
    projectName: input.projectName,
    packageManager: input.packageManager,
    pm: packageManagerAdapter(input.packageManager).docker(
      input.packageManagerVersion ?? FALLBACK_PM_VERSIONS[input.packageManager]
    ),
    language: NODE_LANGUAGE,
    modules: context.modules.map((moduleDefinition) => moduleDefinition.id),
    domainsDir: context.domainsDir,
    target: target.role,
    port: portOf(target.role, context.monorepo),
    scripts: Object.keys(packageJson.scripts ?? {}),
    packageManagerVersion:
      input.packageManagerVersion ?? FALLBACK_PM_VERSIONS[input.packageManager],
    versions: Object.fromEntries(
      Object.entries(NODE_CATALOG).map(([name, entry]) => [name, entry.version])
    ),
    packageNames: Object.fromEntries(
      context.targets.map((candidate) => [candidate.role, candidate.packageName])
    ),
    env,
    slots: context.slots,
    moduleOptions: context.moduleOptions
  }
  const files: PlannedFile[] = [
    generatedFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`),
    ...(env.length === 0
      ? []
      : [
          generatedFile('.env.example', envExample(env)),
          // local values only; an existing .env holds the developer's own settings
          generatedFile('.env', dotEnv(env, input.secret), { strategy: 'skip-if-exists' })
        ])
  ]
  for (const moduleDefinition of target.modules) {
    const include = (outputPath: string): boolean =>
      ruleIncluded(
        context.modules,
        moduleDefinition,
        moduleDefinition.files?.find((rule) => rule.path === outputPath),
        context.moduleOptions,
        context.depth,
        target.role
      )
    files.push(
      ...(await moduleTemplateFiles(
        moduleDefinition,
        templateContext,
        context.moduleOptions[moduleDefinition.id],
        include
      ))
    )
  }
  return {
    files: files.map((file) => ({ ...file, path: inTarget(target.dir, file.path) })),
    env,
    packageJson
  }
}

/** Files only the project root has: the manifest, README, git hooks and pnpm workspace file. */
function rootFiles(
  input: PlanInput,
  context: PlanContext,
  rootPackageJson: PackageJson,
  env: readonly PlannedEnvVar[],
  buildApprovals: readonly string[]
): PlannedFile[] {
  const manifest = manifestFor({
    projectName: input.projectName,
    packageManager: input.packageManager,
    modules: context.modules.map((moduleDefinition) => moduleDefinition.id),
    options: context.moduleOptions,
    depth: context.depth
  })
  const needsWorkspaceFile =
    input.packageManager === 'pnpm' && (buildApprovals.length > 0 || context.monorepo)
  return [
    generatedFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`),
    generatedFile(
      'README.md',
      projectReadme({
        projectName: input.projectName,
        packageManager: input.packageManager,
        modules: context.modules,
        packageJson: rootPackageJson,
        env
      }),
      { strategy: 'skip-if-exists' }
    ),
    // AI assistant context (B17.9, D-45); an existing AGENTS.md or CLAUDE.md is the developer's
    ...(has(context.modules, 'repo-agents-md')
      ? [
          generatedFile(
            'AGENTS.md',
            agentsMd({
              projectName: input.projectName,
              packageManager: input.packageManager,
              modules: context.modules,
              packageJson: rootPackageJson,
              targetDirs: Object.fromEntries(
                context.targets
                  .filter((target) => target.dir !== '')
                  .map((target) => [target.role, target.dir])
              ),
              domainsDir: context.domainsDir
            }),
            { strategy: 'skip-if-exists' }
          ),
          generatedFile('CLAUDE.md', CLAUDE_MD, { strategy: 'skip-if-exists' })
        ]
      : []),
    ...(has(context.modules, 'quality-husky')
      ? huskyFiles(context.modules, input.packageManager, context.monorepo)
      : []),
    ...(needsWorkspaceFile
      ? [
          generatedFile(
            'pnpm-workspace.yaml',
            pnpmWorkspaceYaml(buildApprovals, context.monorepo ? WORKSPACE_GLOBS : []),
            { strategy: 'skip-if-exists' }
          )
        ]
      : [])
  ]
}

const withMergeStrategy = (file: PlannedFile): PlannedFile => {
  const strategy = MERGE_STRATEGIES[path.posix.basename(file.path)]
  return strategy === undefined ? file : { ...file, strategy }
}

/** Resolves the stack and describes everything generation will write and run (buildPlan B3). */
export async function buildGenerationPlan(input: PlanInput): Promise<GenerationPlan> {
  const composition = composeModules(input.selectedModuleNames, input.registry, input.projectName)
  const modules = composition.orderedModules
  const moduleOptions = resolveModuleOptions(modules, input.moduleOptions ?? {})
  const depth = plannedDepth(input)
  const targets = planTargets(input.projectName, modules)
  const domainsDir = modules.some((moduleDefinition) => moduleDefinition.id === 'arch-feature')
    ? 'features'
    : 'modules'
  const slots = renderSlots(modules, (moduleDefinition, fragment) =>
    ruleIncluded(modules, moduleDefinition, fragment, moduleOptions, depth)
  )
  const context: PlanContext = {
    targets,
    modules,
    moduleOptions,
    depth,
    monorepo: isMonorepo(modules),
    domainsDir,
    // slot code imports domain files, so it spells their folder with the same path token
    slots: Object.fromEntries(
      Object.entries(slots).map(([slot, code]) => [slot, resolvePathTokens(code, { domainsDir })])
    )
  }
  const outputs = await Promise.all(targets.map((target) => targetOutput(input, target, context)))
  const env = outputs.flatMap((output) => output.env)
  const rootPackageJson = outputs[0]?.packageJson ?? composition.packageJson

  const files = new Map<string, PlannedFile>()
  for (const file of [
    ...rootFiles(input, context, rootPackageJson, env, composition.buildApprovals),
    ...outputs.flatMap((output) => output.files)
  ]) {
    files.set(file.path, file) // later contributions replace earlier ones
  }
  const dirOf = (moduleDefinition: DevstackModule): string =>
    targets.find((target) => target.modules.includes(moduleDefinition))?.dir ?? ''

  return {
    projectName: input.projectName,
    projectDir: input.projectDir,
    packageManager: input.packageManager,
    modules: modules.map((moduleDefinition) => moduleDefinition.id),
    files: await formatPlannedFiles(
      [...files.values()].map(withMergeStrategy).sort((a, b) => a.path.localeCompare(b.path))
    ),
    commands: planCommands(modules, input.packageManager, input.options, dirOf),
    env,
    depth
  }
}
