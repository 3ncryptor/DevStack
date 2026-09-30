#!/usr/bin/env node
import { Command, CommanderError } from 'commander'

import { CLI_PACKAGE } from '../src/core/manifest'
import { Aborted, EXIT_CODE, exitCodeFor } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import type { CliOptions } from '../src/types/cli'

interface InitFlags {
  preset?: string
  config?: string
  yes: boolean
  advanced: boolean
  inPlace: boolean
  skipInstall: boolean
  skipGit: boolean
  verbose: boolean
  force: boolean
  dryRun: boolean
  printPlan?: true | string
}

const program = new Command()
  .name(CLI_PACKAGE.name)
  .version(CLI_PACKAGE.version)
  .description('Scaffold a running, wired project from the stack you choose')
  .showHelpAfterError()
  // Throw instead of exiting so usage errors get the documented exit code (2), not commander's 1.
  .exitOverride()

// `init` is the default command, so `npx <package> my-app` and `npx <package> init my-app`
// behave the same (buildPlan B11).
program
  .command('init', { isDefault: true })
  .description('Create a new project')
  .argument('[project-name]', 'Name of the project to create')
  .option('--preset <name>', 'Use a predefined preset (example: backend)')
  .option('--config <file>', "Generate from a stack config, e.g. a project's .devstack/stack.json")
  .option('--yes', 'Skip interactive prompts and use defaults', false)
  .option('--advanced', 'Enable advanced module selection mode', false)
  .option('--in-place', 'Generate in current directory instead of creating a new folder', false)
  .option('--skip-install', 'Skip dependency installation', false)
  .option('--skip-git', 'Skip git initialization', false)
  .option('--verbose', 'Print debug output and full error details', false)
  .option('--force', 'Overwrite files that already exist (--yes alone never does)', false)
  .option('--dry-run', 'Show what would be written and run, then stop', false)
  .option('--print-plan [format]', 'Print the plan as text or json and write nothing')
  .action(async (projectName: string | undefined, flags: InitFlags) => {
    const { printPlan, ...rest } = flags
    await runCreateDevstack({
      projectName,
      options: { ...rest, printPlan: printPlan as CliOptions['printPlan'] }
    })
  })

const COMMANDER_SUCCESS_CODES = new Set(['commander.helpDisplayed', 'commander.version'])

function handleFailure(error: unknown): void {
  if (error instanceof CommanderError) {
    // commander has already printed the usage error or the help text
    process.exitCode = COMMANDER_SUCCESS_CODES.has(error.code)
      ? EXIT_CODE.ok
      : EXIT_CODE.invalidInput
    return
  }
  if (error instanceof Aborted) {
    console.error(error.message)
    process.exitCode = error.exitCode
    return
  }

  const message = error instanceof Error ? error.message : String(error)
  console.error(`${CLI_PACKAGE.name} failed: ${message}`)
  if (process.argv.includes('--verbose') && error instanceof Error && error.stack !== undefined) {
    console.error(error.stack)
  }
  process.exitCode = exitCodeFor(error)
}

program.parseAsync(process.argv).catch(handleFailure)
