import path from 'node:path'

import fs from 'fs-extra'

import type { GeneratorContext } from '../types/context'
import type { DevstackModule } from '../types/module'
import { getExecArgs, getHookCommand, getInstallArgs } from '../utils/package-manager'

export async function installProjectDependencies(context: GeneratorContext): Promise<void> {
  if (context.options.skipInstall) {
    context.logger.warn('Skipping dependency installation (--skip-install provided).')
    return
  }

  context.logger.info(`Installing dependencies using ${context.packageManager}...`)
  await context.runPackageManagerCommand(getInstallArgs(context.packageManager))
}

export async function initializeGitRepository(context: GeneratorContext): Promise<void> {
  if (context.options.skipGit) {
    context.logger.warn('Skipping git initialization (--skip-git provided).')
    return
  }

  const gitDirectory = path.join(context.projectDir, '.git')
  if (await fs.pathExists(gitDirectory)) {
    context.logger.debug('Git repository already exists. Skipping git init.')
    return
  }

  context.logger.info('Initializing git repository...')
  await context.runCommand('git', ['init'])
}

export async function setupHuskyHooks(context: GeneratorContext): Promise<void> {
  const huskyDir = path.join(context.projectDir, '.husky')
  await fs.ensureDir(huskyDir)

  const preCommit = path.join(huskyDir, 'pre-commit')
  const commitMsg = path.join(huskyDir, 'commit-msg')

  const lintStagedCommand = getHookCommand(context.packageManager, 'lint-staged')
  const commitlintCommand = `${getHookCommand(context.packageManager, 'commitlint')} --edit "$1"`

  await fs.writeFile(preCommit, `#!/usr/bin/env sh\n${lintStagedCommand}\n`, 'utf8')
  await fs.writeFile(commitMsg, `#!/usr/bin/env sh\n${commitlintCommand}\n`, 'utf8')
  await fs.chmod(preCommit, 0o755)
  await fs.chmod(commitMsg, 0o755)

  if (context.options.skipInstall) {
    context.logger.warn('Skipping husky setup command because dependencies were not installed.')
    return
  }

  if (context.options.skipGit) {
    context.logger.warn('Skipping husky setup command because git initialization is disabled.')
    return
  }

  context.logger.info('Installing husky hooks...')
  await context.runPackageManagerCommand(getExecArgs(context.packageManager, 'husky'))
}

export async function runModulePostInstallHooks(
  modules: DevstackModule[],
  context: GeneratorContext
): Promise<void> {
  for (const moduleDefinition of modules) {
    if (!moduleDefinition.postInstall) {
      continue
    }

    context.logger.info(`Running postInstall hook for module "${moduleDefinition.name}"...`)
    await moduleDefinition.postInstall(context)
  }
}
