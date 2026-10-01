import { packageManagerAdapter } from '../../adapters/package-manager/index'
import { ApplyError } from '../../errors'
import type { GenerationPlan } from '../../types/plan'
import type { Logger } from '../../utils/logger'
import type { CommandRunner } from '../../utils/process'

/** The project's own checks, in the order a developer would run them (A0.4 step 2). */
export const GATES = ['lint', 'format', 'typecheck', 'test', 'build'] as const

const GATE_TIMEOUT_MS = 10 * 60_000

export function plannedScripts(plan: GenerationPlan, dir = ''): Record<string, string> {
  const file = dir === '' ? 'package.json' : `${dir}/package.json`
  const manifest = plan.files.find((candidate) => candidate.path === file)?.content ?? '{}'
  return (JSON.parse(manifest) as { scripts?: Record<string, string> }).scripts ?? {}
}

/** Runs every gate the project has; the first failure stops generation with its output. */
export async function runGates(
  plan: GenerationPlan,
  run: CommandRunner,
  logger: Logger
): Promise<string[]> {
  const pm = packageManagerAdapter(plan.packageManager)
  const scripts = plannedScripts(plan)
  const gates = GATES.filter((gate) => scripts[gate] !== undefined)
  for (const gate of gates) {
    logger.info(`Checking the project: ${gate}...`)
    const result = await run(plan.packageManager, pm.run(gate), {
      cwd: plan.projectDir,
      timeoutMs: GATE_TIMEOUT_MS
    })
    if (!result.ok) {
      throw new ApplyError(
        `The generated project failed its own ${gate} check (${plan.packageManager} run ${gate}):\n` +
          `${result.output}\nThe files are written; fix the problem and run it again in the project.`
      )
    }
  }
  return gates
}
