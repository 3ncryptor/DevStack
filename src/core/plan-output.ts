import { createHash } from 'node:crypto'

import type { GenerationPlan } from '../types/plan'
import type { ClassifiedFile, FileStatus } from './apply/index'

const STATUS_MARK: Record<FileStatus, string> = { new: '+', overwrite: '~', keep: '=', merge: '±' }
const STATUS_LABEL: Record<FileStatus, string> = {
  new: 'new',
  overwrite: 'exists (conflict)',
  keep: 'exists (kept)',
  merge: 'exists (merged: additions only)'
}

/** Human-readable plan for `--dry-run` / `--print-plan`. */
export function formatPlanText(plan: GenerationPlan, files: readonly ClassifiedFile[]): string {
  const lines = [
    `Plan for ${plan.projectName} in ${plan.projectDir} (${plan.packageManager})`,
    '',
    `Modules: ${plan.modules.join(', ')}`,
    '',
    `Files (${files.length}):`,
    ...files.map((entry) => {
      const mode = entry.file.mode === 0o755 ? ' (executable)' : ''
      return `  ${STATUS_MARK[entry.status]} ${entry.file.path}${mode}  ${STATUS_LABEL[entry.status]}`
    }),
    '',
    `Commands (${plan.commands.length}):`,
    ...plan.commands.map(
      (command) =>
        `  $ ${[command.command, ...command.args].join(' ')}${command.cwd === undefined ? '' : `   (in ${command.cwd})`}`
    ),
    ''
  ]
  return lines.join('\n')
}

export interface PlanJson {
  projectName: string
  projectDir: string
  packageManager: string
  modules: string[]
  files: Array<{
    path: string
    bytes: number
    sha256: string
    mode: string
    strategy: string
    status: FileStatus
  }>
  commands: Array<{ phase: string; command: string[] }>
}

/** Machine-readable plan for `--print-plan json` (agents, scripts). */
export function planToJson(plan: GenerationPlan, files: readonly ClassifiedFile[]): PlanJson {
  return {
    projectName: plan.projectName,
    projectDir: plan.projectDir,
    packageManager: plan.packageManager,
    modules: plan.modules,
    files: files.map((entry) => ({
      path: entry.file.path,
      bytes: Buffer.byteLength(entry.file.content),
      sha256: createHash('sha256').update(entry.file.content).digest('hex'),
      mode: entry.file.mode.toString(8),
      strategy: entry.file.strategy,
      status: entry.status
    })),
    commands: plan.commands.map((command) => ({
      phase: command.phase,
      command: [command.command, ...command.args]
    }))
  }
}
