#!/usr/bin/env node
import { Command, CommanderError } from 'commander'

import { configGet, configList, configPath, configSet, configUnset } from '../src/commands/config'
import { runDoctor } from '../src/commands/doctor'
import { addModules, removeModules, type EvolveOptions } from '../src/commands/evolve'
import { presetsDelete, presetsList, presetsSave, presetsShow } from '../src/commands/presets'
import { listModules } from '../src/commands/modules'
import { systemProbe } from '../src/core/doctor'
import { CLI_PACKAGE } from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { Aborted, EXIT_CODE, exitCodeFor } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import type { CliOptions } from '../src/types/cli'
import { ConsoleLogger } from '../src/utils/logger'

interface InitFlags {
  preset?: string
  pm?: string
  depth?: string
  moduleSystem?: string
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
  .option('--module-system <system>', 'esm (default) or cjs (CommonJS) for the backend')
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
    const { printPlan, pm, depth, moduleSystem, ...rest } = flags
    await runCreateDevstack({
      projectName,
      options: {
        ...rest,
        pm: pm as CliOptions['pm'],
        depth: depth as CliOptions['depth'],
        moduleSystem: moduleSystem as CliOptions['moduleSystem'],
        printPlan: printPlan as CliOptions['printPlan']
      }
    })
  })

interface PlanFlags {
  preset?: string
  config?: string
  pm?: string
  depth?: string
  moduleSystem?: string
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
  .option('--module-system <system>', 'esm or cjs')
  .option('--json', 'Print the plan as JSON', false)
  .action(async (projectName: string | undefined, flags: PlanFlags) => {
    await runCreateDevstack({
      projectName,
      options: {
        preset: flags.preset,
        config: flags.config,
        pm: flags.pm as CliOptions['pm'],
        depth: flags.depth as CliOptions['depth'],
        moduleSystem: flags.moduleSystem as CliOptions['moduleSystem'],
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
  .description('Check Node.js, package managers, git and Docker; in a project, catalog drift')
  .action(async () => {
    process.exitCode = await runDoctor(systemProbe, (text) => {
      process.stdout.write(`${text}\n`)
    })
  })

const print = (text: string): void => {
  process.stdout.write(text)
}

interface EvolveFlags {
  dryRun: boolean
  force: boolean
  skipInstall: boolean
  verbose: boolean
}

const evolveOptions = (flags: EvolveFlags): EvolveOptions => ({
  projectDir: process.cwd(),
  dryRun: flags.dryRun,
  force: flags.force,
  skipInstall: flags.skipInstall,
  logger: new ConsoleLogger({ verbose: flags.verbose, silent: false })
})

// Change a generated project's stack (tasks 5.6, 5.8): run in the project's root folder.
for (const [name, description, run] of [
  ['add', 'Add modules to this DevStack project', addModules],
  ['remove', 'Remove modules from this DevStack project', removeModules]
] as const) {
  program
    .command(name)
    .description(description)
    .argument('<modules...>', 'Module ids, e.g. security-rate-limit (see modules list)')
    .option('--dry-run', 'List the changes and write nothing', false)
    .option('--force', 'Overwrite files you edited (originals are backed up)', false)
    .option('--skip-install', 'Do not run the package manager afterwards', false)
    .option('--verbose', 'Print debug output', false)
    .action(async (modules: string[], flags: EvolveFlags) => {
      print((await run(modules, evolveOptions(flags))).report)
    })
}

// MCP server for AI assistants (task 5.7, D-84): stdio, started by the client; the SDK loads
// only here, so every other command starts without it.
program
  .command('mcp')
  .description('Serve DevStack to AI assistants over MCP (stdio): list, validate, plan, init, add')
  .action(async () => {
    const { runMcpServer } = await import('../src/mcp/server')
    await runMcpServer()
  })

// Remembered defaults (task 5.4): what the wizard pre-selects and --yes uses.
const config = program
  .command('config')
  .description('Remembered defaults: package manager, depth, code style, license, wizard answers')
config
  .command('path')
  .description('Print where the defaults are stored')
  .action(() => {
    print(configPath())
  })
config
  .command('list')
  .description('Print every remembered default')
  .action(async () => {
    print(await configList())
  })
config
  .command('get')
  .description('Print one default, e.g. settings.style.semi')
  .argument('<key>', 'Dotted key')
  .action(async (key: string) => {
    print(await configGet(key))
  })
config
  .command('set')
  .description('Remember a default, e.g. config set settings.license MIT')
  .argument('<key>', 'Dotted key, e.g. packageManager or settings.style.printWidth')
  .argument('<value>', 'JSON (true, 80, ["a"]) or a plain string')
  .action(async (key: string, value: string) => {
    print(await configSet(key, value))
  })
config
  .command('unset')
  .description('Forget a default')
  .argument('<key>', 'Dotted key')
  .action(async (key: string) => {
    print(await configUnset(key))
  })

// Named presets (task 5.5): built in, or saved from a project with presets save.
const presets = program.command('presets').description('List, show, save and delete presets')
presets
  .command('list')
  .description('Built-in presets and your own')
  .action(async () => {
    print(await presetsList())
  })
presets
  .command('show')
  .description('Print a preset as JSON')
  .argument('<name>', 'Preset name')
  .action(async (name: string) => {
    print(await presetsShow(name))
  })
presets
  .command('save')
  .description("Save this project's stack (or a stack config) as a preset for --preset <name>")
  .argument('<name>', 'Preset name, kebab-case')
  .option('--from <file>', 'A stack config to save instead of .devstack/stack.json')
  .option('--description <text>', 'Shown in presets list and the wizard')
  .option('--force', 'Replace a preset of the same name', false)
  .action(async (name: string, flags: { from?: string; description?: string; force: boolean }) => {
    print(await presetsSave(name, flags))
  })
presets
  .command('delete')
  .description('Delete one of your presets')
  .argument('<name>', 'Preset name')
  .action(async (name: string) => {
    print(await presetsDelete(name))
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
