import type { DevstackModule } from '../../types/module'
import type { PlannedCommand } from '../../types/plan'
import { packageManagerAdapter, type PackageManagerId } from '../../adapters/package-manager/index'

export interface CommandOptions {
  skipInstall: boolean
  skipGit: boolean
}

/** Git, install, hook and module commands, in the order they run. */
export function planCommands(
  modules: readonly DevstackModule[],
  packageManager: PackageManagerId,
  options: CommandOptions
): PlannedCommand[] {
  const pm = packageManagerAdapter(packageManager)
  const commands: PlannedCommand[] = []
  const hasHusky = modules.some((moduleDefinition) => moduleDefinition.id === 'quality-husky')

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
    args: pm.install(),
    description: `Install dependencies with ${packageManager}`
  })
  if (hasHusky && !options.skipGit) {
    commands.push({
      phase: 'hooks',
      command: packageManager,
      args: pm.exec('husky'),
      description: 'Install git hooks'
    })
  }
  for (const moduleDefinition of modules) {
    for (const moduleCommand of moduleDefinition.commands ?? []) {
      const [binary, ...args] = moduleCommand.run
      commands.push({
        phase: moduleCommand.phase,
        command: packageManager,
        args: pm.exec(binary, args),
        description: `${moduleDefinition.id}: ${moduleCommand.run.join(' ')}`
      })
    }
  }
  return commands
}
