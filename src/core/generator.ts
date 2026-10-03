import { existsSync } from 'node:fs'
import path from 'node:path'

import type { Prompter } from '../intake/prompter'
import type { GeneratorOptions } from '../types/context'
import type { DevstackModule } from '../types/module'
import type { GenerationPlan } from '../types/plan'
import type { Logger } from '../utils/logger'
import type { ProjectSettings } from './settings'
import type { PackageManagerId as PackageManager } from '../adapters/package-manager/index'
import { runPlanCommands } from './apply/commands'
import { applyPlan, classifyFiles } from './apply/index'
import { formatPlanText, planToJson } from './plan-output'
import { buildSummary } from './summary'
import { finishProject, type FinishResult } from './finish/index'
import { startProject } from './finish/start'
import { buildGenerationPlan } from './planner/index'

export interface GenerateProjectInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  moduleOptions?: Readonly<Record<string, unknown>>
  depth?: 'bare' | 'wired'
  registry: Map<string, DevstackModule>
  packageManager: PackageManager
  /** Installed version (from the pre-flight), for a monorepo's `packageManager` field. */
  packageManagerVersion?: string
  /** Project settings (tasks 5.1-5.3) from the config, a preset or remembered defaults. */
  settings?: ProjectSettings
  options: GeneratorOptions
  logger: Logger
  prompter: Prompter
}

type PlanFormat = 'text' | 'json'

function requestedPlanFormat(options: GeneratorOptions): PlanFormat | undefined {
  if (options.printPlan === true) return 'text'
  if (options.printPlan !== undefined) return options.printPlan
  return options.dryRun ? 'text' : undefined
}

async function printPlan(plan: GenerationPlan, format: PlanFormat, logger: Logger): Promise<void> {
  const classified = await classifyFiles(plan)
  const output =
    format === 'json'
      ? `${JSON.stringify(planToJson(plan, classified), null, 2)}\n`
      : formatPlanText(plan, classified)
  process.stdout.write(output)
  logger.info('Dry run: nothing was written and no commands were run.')
}

/** Plans the project, then either prints the plan (dry run) or writes it and runs its commands. */
export async function generateProject(input: GenerateProjectInput): Promise<void> {
  const plan = await buildGenerationPlan({
    projectName: input.projectName,
    projectDir: input.projectDir,
    selectedModuleNames: input.selectedModuleNames,
    moduleOptions: input.moduleOptions,
    depth: input.depth,
    registry: input.registry,
    packageManager: input.packageManager,
    packageManagerVersion: input.packageManagerVersion,
    settings: input.settings,
    options: { skipInstall: input.options.skipInstall, skipGit: input.options.skipGit }
  })

  const format = requestedPlanFormat(input.options)
  if (format !== undefined) {
    await printPlan(plan, format, input.logger)
    return
  }

  input.logger.info(`Composing project with modules: ${plan.modules.join(', ')}`)
  // checked before anything is written: an existing repository's history is the user's
  const preexistingRepo = existsSync(path.join(plan.projectDir, '.git'))
  const result = await applyPlan(plan, {
    yes: input.options.yes,
    force: input.options.force,
    prompter: input.prompter,
    logger: input.logger
  })
  input.logger.info(`Wrote ${result.written.length} files.`)

  await runPlanCommands(plan, input.logger)
  const finish = await finishProject({
    plan,
    skipInstall: input.options.skipInstall,
    skipVerify: input.options.skipVerify,
    skipGit: input.options.skipGit,
    github: input.options.github,
    yes: input.options.yes,
    preexistingRepo,
    prompter: input.prompter,
    logger: input.logger
  })
  input.logger.success(
    buildSummary(
      plan,
      result,
      { inPlace: input.options.inPlace, skipInstall: input.options.skipInstall },
      finish
    )
  )
  if (await shouldStart(input, finish)) await startProject(plan, input.logger)
}

/** "Start it now?" (A0.4 step 7): asked only after a verified run; --start skips the question. */
async function shouldStart(input: GenerateProjectInput, finish: FinishResult): Promise<boolean> {
  if (input.options.start) return true
  if (input.options.yes || finish.verification.status !== 'verified') return false
  return input.prompter.confirm({ message: 'Start it now? (db:up, then dev)', initialValue: false })
}
