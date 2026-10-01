#!/usr/bin/env node
import { Command, CommanderError } from 'commander'

import { runDoctor } from '../src/commands/doctor'
import { listModules } from '../src/commands/modules'
import { systemProbe } from '../src/core/doctor'
import { CLI_PACKAGE } from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { Aborted, EXIT_CODE, exitCodeFor } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import type { CliOptions } from '../src/types/cli'

interface InitFlags {
  preset?: string
  pm?: string
  depth?: string
  config?: string
  yes: boolean
  advanced: boolean
  inPlace: boolean
  skipInstall: boolean
  skipGit: boolean
  skipVerify: boolean
  github?: string
  start: boolean
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
  .option(
    '--depth <level>',
    'bare (config and tooling only) or wired (default, adds integration code)'
  )
  .option('--pm <name>', 'Package manager for the project: npm, pnpm, yarn or bun')
  .option('--config <file>', "Generate from a stack config, e.g. a project's .devstack/stack.json")
  .option('--yes', 'Skip interactive prompts and use defaults', false)
  .option('--advanced', 'Enable advanced module selection mode', false)
  .option('--in-place', 'Generate in current directory instead of creating a new folder', false)
  .option('--skip-install', 'Skip dependency installation', false)
  .option('--skip-git', 'Skip git initialization', false)
  .option('--skip-verify', 'Skip the checks and boot test after install', false)
  .option('--github <url>', 'Push the initial commit to this existing, empty GitHub repository')
  .option('--start', 'Start the project when it is ready (db:up, then dev)', false)
  .option('--verbose', 'Print debug output and full error details', false)
  .option('--force', 'Overwrite files that already exist (--yes alone never does)', false)
  .option('--dry-run', 'Show what would be written and run, then stop', false)
  .option('--print-plan [format]', 'Print the plan as text or json and write nothing')
  .action(async (projectName: string | undefined, flags: InitFlags) => {
    const { printPlan, pm, depth, ...rest } = flags
    await runCreateDevstack({
      projectName,
      options: {
        ...rest,
        pm: pm as CliOptions['pm'],
        depth: depth as CliOptions['depth'],
        printPlan: printPlan as CliOptions['printPlan']
      }
    })
  })

interface PlanFlags {
  preset?: string
  config?: string
  pm?: string
  depth?: string
  json: boolean
}

// Post-init commands live on the same bin for now (Q-12 is open): `npx <package> doctor`.
// A project named like a command needs the explicit form: `npx <package> init doctor`.
program
  .command('plan')
  .description('Resolve a stack and print what init would write and run; writes nothing')
  .argument('[project-name]', 'Name to plan for (default: from the config, or devstack-app)')
  .option('--preset <name>', 'Plan a predefined preset (default: backend)')
  .option('--config <file>', 'Plan a stack config, e.g. .devstack/stack.json')
  .option('--pm <name>', 'Package manager: npm, pnpm, yarn or bun')
  .option('--depth <level>', 'bare or wired')
  .option('--json', 'Print the plan as JSON', false)
  .action(async (projectName: string | undefined, flags: PlanFlags) => {
    await runCreateDevstack({
      projectName,
      options: {
        preset: flags.preset,
        config: flags.config,
        pm: flags.pm as CliOptions['pm'],
        depth: flags.depth as CliOptions['depth'],
        yes: true,
        printPlan: flags.json ? 'json' : 'text'
      }
    })
  })

program
  .command('modules')
  .description('Inspect the module registry')
  .command('list')
  .description('List modules by category')
  .option('--category <name>', 'Only modules of this category')
  .option('--json', 'Print JSON', false)
  .action((flags: { category?: string; json: boolean }) => {
    process.stdout.write(listModules(loadModules(), flags))
  })

program
  .command('doctor')
  .description('Check Node.js, package managers, git and Docker')
  .action(async () => {
    process.exitCode = await runDoctor(systemProbe, (text) => {
      process.stdout.write(`${text}\n`)
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
