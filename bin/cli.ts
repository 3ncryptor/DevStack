#!/usr/bin/env node
import { Command } from 'commander'

import { runCreateDevstack } from '../src'

const program = new Command()

program
  .name('create-devstack')
  .description('Modular backend project scaffolding CLI')
  .argument('[project-name]', 'Name of the project to create')
  .option('--preset <name>', 'Use a predefined preset (example: backend)')
  .option('--yes', 'Skip interactive prompts and use defaults', false)
  .option('--advanced', 'Enable advanced module selection mode', false)
  .option('--in-place', 'Generate in current directory instead of creating a new folder', false)
  .option('--skip-install', 'Skip dependency installation', false)
  .option('--skip-git', 'Skip git initialization', false)
  .action(async (projectName: string | undefined, options: Record<string, unknown>) => {
    await runCreateDevstack({
      projectName,
      options: {
        preset: typeof options.preset === 'string' ? options.preset : undefined,
        yes: options.yes === true,
        advanced: options.advanced === true,
        inPlace: options.inPlace === true,
        skipInstall: options.skipInstall === true,
        skipGit: options.skipGit === true
      }
    })
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  console.error(`create-devstack failed: ${errorMessage}`)
  process.exitCode = 1
})
