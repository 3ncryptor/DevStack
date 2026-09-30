import type { Prompter } from '../intake/prompter'
import type { GeneratorOptions } from '../types/context'
import type { DevstackModule } from '../types/module'
import type { GenerationPlan } from '../types/plan'
import type { Logger } from '../utils/logger'
import type { PackageManager } from '../utils/package-manager'
import { runPlanCommands } from './apply/commands'
import { applyPlan, classifyFiles } from './apply/index'
import { formatPlanText, planToJson } from './plan-output'
import { buildGenerationPlan } from './planner/index'

export interface GenerateProjectInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  registry: Map<string, DevstackModule>
  packageManager: PackageManager
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
    registry: input.registry,
    packageManager: input.packageManager,
    options: { skipInstall: input.options.skipInstall, skipGit: input.options.skipGit }
  })

  const format = requestedPlanFormat(input.options)
  if (format !== undefined) {
    await printPlan(plan, format, input.logger)
    return
  }

  input.logger.info(`Composing project with modules: ${plan.modules.join(', ')}`)
  const result = await applyPlan(plan, {
    yes: input.options.yes,
    force: input.options.force,
    prompter: input.prompter,
    logger: input.logger
  })
  input.logger.info(`Wrote ${result.written.length} files.`)
  if (result.kept.length > 0) {
    input.logger.warn(`Kept ${result.kept.length} existing file(s): ${result.kept.join(', ')}`)
  }
  if (result.backupDir !== undefined) {
    input.logger.warn(
      `Overwrote ${result.overwritten.length} file(s); the originals are saved in ${result.backupDir}`
    )
  }

  await runPlanCommands(plan, input.logger)
  input.logger.success(`Project created at ${input.projectDir}`)
}
