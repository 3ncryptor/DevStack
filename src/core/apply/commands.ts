import { access } from 'node:fs/promises'

import { execa, ExecaError } from 'execa'

import { CommandFailedError } from '../../errors'
import type { GenerationPlan, PlannedCommand } from '../../types/plan'
import type { Logger } from '../../utils/logger'
import { resolveInside } from '../project-name'

async function shouldSkip(plan: GenerationPlan, command: PlannedCommand): Promise<boolean> {
  if (command.skipIfExists === undefined) {
    return false
  }
  return access(resolveInside(plan.projectDir, command.skipIfExists)).then(
    () => true,
    () => false
  )
}

/**
 * Where the commands' own output goes: the terminal, or stderr when stdout carries something
 * else, e.g. the MCP protocol (task 5.7).
 */
export type CommandOutput = 'inherit' | 'stderr'

/** A command as the user would type it in the project folder. */
function commandLine(command: PlannedCommand): string {
  const line = [command.command, ...command.args].join(' ')
  return command.cwd === undefined ? line : `(cd ${command.cwd} && ${line})`
}

async function runOne(command: PlannedCommand, cwd: string, output: CommandOutput): Promise<void> {
  if (output === 'inherit') {
    await execa(command.command, command.args, { cwd, stdio: 'inherit' })
    return
  }
  const child = execa(command.command, command.args, {
    cwd,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe'
  })
  child.stdout.pipe(process.stderr)
  child.stderr.pipe(process.stderr)
  await child
}

/** Runs the plan's commands in order, in the project directory, without a shell. */
export async function runPlanCommands(
  plan: GenerationPlan,
  logger: Logger,
  output: CommandOutput = 'inherit'
): Promise<void> {
  for (const [index, command] of plan.commands.entries()) {
    if (await shouldSkip(plan, command)) {
      logger.debug(`Skipping "${command.description}": ${command.skipIfExists} already exists.`)
      continue
    }
    logger.info(`${command.description}...`)
    try {
      await runOne(command, resolveInside(plan.projectDir, command.cwd ?? '.'), output)
    } catch (error: unknown) {
      const reason = error instanceof ExecaError ? error.shortMessage : String(error)
      throw new CommandFailedError(
        `Command failed: ${commandLine(command)}\n${reason}\n` +
          'The project files were written; fix the problem and re-run this command in the project.',
        plan.commands.slice(index).map(commandLine),
        { cause: error }
      )
    }
  }
}
