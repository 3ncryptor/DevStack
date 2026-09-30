import type { DevstackModule } from '../../types/module'
import type { PlannedCommand } from '../../types/plan'
import { getExecArgs, getInstallArgs, type PackageManager } from '../../utils/package-manager'

export interface CommandOptions {
  skipInstall: boolean
  skipGit: boolean
}

/** Git, install, hook and module commands, in the order they run. */
export function planCommands(
  modules: readonly DevstackModule[],
  packageManager: PackageManager,
  options: CommandOptions
): PlannedCommand[] {
  const commands: PlannedCommand[] = []
  const hasHusky = modules.some((moduleDefinition) => moduleDefinition.name === 'quality-husky')

  if (!options.skipGit) {
    commands.push({
      phase: 'git',
      command: 'git',
      args: ['init'],
      description: 'Initialise a git repository',
      skipIfExists: '.git'
    })
  }
  if (options.skipInstall) {
    return commands
  }

  commands.push({
    phase: 'install',
    command: packageManager,
    args: getInstallArgs(packageManager),
    description: `Install dependencies with ${packageManager}`
  })
  if (hasHusky && !options.skipGit) {
    commands.push({
      phase: 'hooks',
      command: packageManager,
      args: getExecArgs(packageManager, 'husky'),
      description: 'Install git hooks'
    })
  }
  for (const moduleDefinition of modules) {
    for (const moduleCommand of moduleDefinition.commands ?? []) {
      const [binary, ...args] = moduleCommand.run
      commands.push({
        phase: moduleCommand.phase,
        command: packageManager,
        args: getExecArgs(packageManager, binary, args),
        description: `${moduleDefinition.name}: ${moduleCommand.run.join(' ')}`
      })
    }
  }
  return commands
}
