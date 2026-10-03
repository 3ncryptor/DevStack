import { createHash } from 'node:crypto'

import type { GenerationPlan } from '../../src/types/plan'

/** A plan as a snapshot sees it: every file by path and content hash, and the commands. */
export function summarisePlan(plan: GenerationPlan) {
  return {
    modules: plan.modules,
    files: plan.files.map((file) => ({
      path: file.path,
      mode: file.mode.toString(8),
      strategy: file.strategy,
      sha256: createHash('sha256').update(file.content).digest('hex').slice(0, 16)
    })),
    commands: plan.commands.map((command) => [command.phase, command.command, ...command.args])
  }
}
