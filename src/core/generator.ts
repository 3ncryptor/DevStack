import path from 'node:path'

import deepmerge from 'deepmerge'
import execa from 'execa'
import fs from 'fs-extra'
import inquirer from 'inquirer'

import type { GeneratorContext, GeneratorOptions } from '../types/context'
import type { DevstackModule } from '../types/module'
import type { PackageJson } from '../types/package-json'
import type { Logger } from '../utils/logger'
import type { PackageManager } from '../utils/package-manager'
import { getExecArgs } from '../utils/package-manager'
import { composeModules } from './composer'
import { mergeModuleFiles } from './file-merger'
import {
  initializeGitRepository,
  installProjectDependencies,
  runModulePostInstallHooks,
  setupHuskyHooks
} from './installer'

export interface GenerateProjectInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  registry: Map<string, DevstackModule>
  packageManager: PackageManager
  options: GeneratorOptions
  logger: Logger
}

async function ensureProjectDirectory(projectDir: string, yes: boolean): Promise<void> {
  const exists = await fs.pathExists(projectDir)
  if (!exists) {
    await fs.ensureDir(projectDir)
    return
  }

  const entries = await fs.readdir(projectDir)
  if (entries.length === 0 || yes) {
    return
  }

  const answer = await inquirer.prompt<{ continueWithMerge: boolean }>([
    {
      type: 'confirm',
      name: 'continueWithMerge',
      message: `Directory ${projectDir} is not empty. Continue and merge files?`,
      default: false
    }
  ])

  if (!answer.continueWithMerge) {
    throw new Error('Aborted by user because target directory is not empty.')
  }
}

type ExistingPackageAction = 'merge' | 'overwrite' | 'abort'

async function readExistingPackageJson(packageJsonPath: string): Promise<Partial<PackageJson>> {
  return (await fs.readJson(packageJsonPath)) as Partial<PackageJson>
}

async function resolveExistingPackageAction(): Promise<ExistingPackageAction> {
  const answer = await inquirer.prompt<{ action: ExistingPackageAction }>([
    {
      type: 'list',
      name: 'action',
      message: 'A package.json already exists. How should create-devstack proceed?',
      choices: [
        { name: 'Merge generated config into existing package.json', value: 'merge' },
        { name: 'Overwrite existing package.json', value: 'overwrite' },
        { name: 'Abort', value: 'abort' }
      ],
      default: 'merge'
    }
  ])

  return answer.action
}

async function writeProjectPackageJson(
  projectDir: string,
  packageJson: PackageJson,
  yes: boolean
): Promise<void> {
  const packageJsonPath = path.join(projectDir, 'package.json')
  const exists = await fs.pathExists(packageJsonPath)

  if (!exists) {
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
    return
  }

  let action: ExistingPackageAction = 'merge'
  if (!yes) {
    action = await resolveExistingPackageAction()
  }

  if (action === 'abort') {
    throw new Error('Aborted by user because package.json already exists.')
  }

  if (action === 'overwrite') {
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
    return
  }

  const existingPackageJson = await readExistingPackageJson(packageJsonPath)
  const mergedPackageJson: PackageJson = deepmerge(packageJson, existingPackageJson)
  await fs.writeJson(packageJsonPath, mergedPackageJson, { spaces: 2 })
}

async function writeProjectMetaFiles(projectDir: string): Promise<void> {
  const readmePath = path.join(projectDir, 'README.md')
  if (!(await fs.pathExists(readmePath))) {
    const readme = `# ${path.basename(projectDir)}\n\nGenerated with create-devstack.\n`
    await fs.writeFile(readmePath, readme, 'utf8')
  }

  const commitlintPath = path.join(projectDir, 'commitlint.config.cjs')
  if (!(await fs.pathExists(commitlintPath))) {
    await fs.writeFile(
      commitlintPath,
      "module.exports = { extends: ['@commitlint/config-conventional'] }\n",
      'utf8'
    )
  }
}

interface MetaFileOptions {
  hasPrettier: boolean
  hasEslint: boolean
}

function createLintStagedConfig(options: MetaFileOptions): Record<string, string[]> {
  const config: Record<string, string[]> = {}

  if (options.hasPrettier) {
    config['*.{js,ts,tsx,jsx,json,md,yml,yaml}'] = ['prettier --write']
  }

  if (options.hasEslint) {
    config['src/**/*.ts'] = ['eslint --fix']
    config['tests/**/*.ts'] = ['eslint --fix']
  }

  return config
}

async function writeLintStagedFile(projectDir: string, options: MetaFileOptions): Promise<void> {
  const lintStagedPath = path.join(projectDir, '.lintstagedrc.json')
  if (await fs.pathExists(lintStagedPath)) {
    return
  }

  const lintStagedConfig = createLintStagedConfig(options)
  await fs.writeJson(lintStagedPath, lintStagedConfig, { spaces: 2 })
}

function createContext(input: GenerateProjectInput): GeneratorContext {
  const runCommand = async (command: string, args: string[]): Promise<void> => {
    await execa(command, args, {
      cwd: input.projectDir,
      stdio: 'inherit'
    })
  }

  return {
    projectName: input.projectName,
    projectDir: input.projectDir,
    packageManager: input.packageManager,
    logger: input.logger,
    options: input.options,
    runCommand,
    runPackageManagerCommand: async (args: string[]) => {
      await runCommand(input.packageManager, args)
    },
    runPackageManagerExec: async (binary: string, args: string[] = []) => {
      await runCommand(input.packageManager, getExecArgs(input.packageManager, binary, args))
    }
  }
}

export async function generateProject(input: GenerateProjectInput): Promise<void> {
  await ensureProjectDirectory(input.projectDir, input.options.yes)

  const composition = composeModules(input.selectedModuleNames, input.registry, input.projectName)

  const context = createContext(input)
  const hasHuskyModule = composition.orderedModules.some(
    (moduleDefinition) => moduleDefinition.name === 'quality-husky'
  )
  const hasPrettierModule = composition.orderedModules.some(
    (moduleDefinition) => moduleDefinition.name === 'formatter-prettier'
  )
  const hasEslintModule = composition.orderedModules.some(
    (moduleDefinition) => moduleDefinition.name === 'linter-eslint'
  )

  input.logger.info(
    `Composing project with modules: ${composition.orderedModules.map((m) => m.name).join(', ')}`
  )

  await writeProjectPackageJson(input.projectDir, composition.packageJson, input.options.yes)
  if (hasHuskyModule) {
    await writeProjectMetaFiles(input.projectDir)
    await writeLintStagedFile(input.projectDir, {
      hasPrettier: hasPrettierModule,
      hasEslint: hasEslintModule
    })
  }
  await mergeModuleFiles(composition.orderedModules, context)

  await initializeGitRepository(context)
  await installProjectDependencies(context)
  if (hasHuskyModule) {
    await setupHuskyHooks(context)
  }
  await runModulePostInstallHooks(composition.orderedModules, context)

  input.logger.success(`Project created at ${input.projectDir}`)
}
