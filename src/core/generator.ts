import type { Prompter } from '../intake/prompter'
import type { GeneratorOptions } from '../types/context'
import type { DevstackModule } from '../types/module'
import type { GenerationPlan } from '../types/plan'
import type { Logger } from '../utils/logger'
import type { PackageManagerId as PackageManager } from '../adapters/package-manager/index'
import { runPlanCommands } from './apply/commands'
import { applyPlan, classifyFiles } from './apply/index'
import { formatPlanText, planToJson } from './plan-output'
import { buildSummary } from './summary'
import { buildGenerationPlan } from './planner/index'

export interface GenerateProjectInput {
  projectName: string
  projectDir: string
  selectedModuleNames: string[]
  moduleOptions?: Readonly<Record<string, unknown>>
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
    moduleOptions: input.moduleOptions,
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

  await runPlanCommands(plan, input.logger)
  input.logger.success(
    buildSummary(plan, result, {
      inPlace: input.options.inPlace,
      skipInstall: input.options.skipInstall
    })
  )
}
