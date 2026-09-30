import type { DevstackModule } from '../../types/module'
import type { PackageJson } from '../../types/package-json'
import type { GenerationPlan, PlannedFile } from '../../types/plan'
import { getHookCommand, type PackageManager } from '../../utils/package-manager'
import { composeModules } from '../composer'
import { planCommands, type CommandOptions } from './commands'
import { EXECUTABLE_MODE, generatedFile, moduleTemplateFiles } from './files'
import { formatPlannedFiles } from './format'
import { pnpmWorkspaceYaml } from './pnpm'
import { renderSlots } from './slots'
import type { TemplateContext } from './templates'

export interface PlanInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  registry: Map<string, DevstackModule>
  packageManager: PackageManager
  options: CommandOptions
}

function has(modules: readonly DevstackModule[], id: string): boolean {
  return modules.some((moduleDefinition) => moduleDefinition.name === id)
}

function lintStagedConfig(modules: readonly DevstackModule[]): Record<string, string[]> {
  const config: Record<string, string[]> = {}
  if (has(modules, 'formatter-prettier')) {
    config['*.{js,ts,tsx,jsx,json,md,yml,yaml}'] = ['prettier --write']
  }
  if (has(modules, 'linter-eslint')) {
    config['src/**/*.ts'] = ['eslint --fix']
    config['tests/**/*.ts'] = ['eslint --fix']
  }
  return config
}

function huskyFiles(
  projectName: string,
  modules: readonly DevstackModule[],
  packageManager: PackageManager
): PlannedFile[] {
  const lintStaged = getHookCommand(packageManager, 'lint-staged')
  const commitlint = `${getHookCommand(packageManager, 'commitlint')} --edit "$1"`
  return [
    generatedFile('README.md', `# ${projectName}\n\nGenerated with create-devstack.\n`, {
      strategy: 'skip-if-exists'
    }),
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

async function collectFiles(
  input: PlanInput,
  modules: readonly DevstackModule[],
  packageJson: PackageJson,
  buildApprovals: readonly string[]
): Promise<PlannedFile[]> {
  const files = new Map<string, PlannedFile>()
  const add = (file: PlannedFile): void => {
    files.set(file.path, file) // later contributions replace earlier ones
  }

  add(generatedFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`))
  if (has(modules, 'quality-husky')) {
    for (const file of huskyFiles(input.projectName, modules, input.packageManager)) add(file)
  }
  const context: TemplateContext = {
    projectName: input.projectName,
    packageManager: input.packageManager,
    slots: renderSlots(modules)
  }
  for (const moduleDefinition of modules) {
    for (const file of await moduleTemplateFiles(moduleDefinition, context)) add(file)
  }
  if (input.packageManager === 'pnpm' && buildApprovals.length > 0) {
    add(
      generatedFile('pnpm-workspace.yaml', pnpmWorkspaceYaml(buildApprovals), {
        strategy: 'skip-if-exists'
      })
    )
  }
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path))
}

/** Resolves the stack and describes everything generation will write and run (buildPlan B3). */
export async function buildGenerationPlan(input: PlanInput): Promise<GenerationPlan> {
  const composition = composeModules(input.selectedModuleNames, input.registry, input.projectName)
  const modules = composition.orderedModules
  const files = await collectFiles(
    input,
    modules,
    composition.packageJson,
    composition.buildApprovals
  )

  return {
    projectName: input.projectName,
    projectDir: input.projectDir,
    packageManager: input.packageManager,
    modules: modules.map((moduleDefinition) => moduleDefinition.name),
    files: await formatPlannedFiles(files),
    commands: planCommands(modules, input.packageManager, input.options)
  }
}
