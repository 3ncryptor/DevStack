import { readFile } from 'node:fs/promises'

import { Aborted, InputError } from '../../errors'
import type { Prompter } from '../../intake/prompter'
import type { GenerationPlan, PlannedFile } from '../../types/plan'
import type { Logger } from '../../utils/logger'
import { resolveInside } from '../project-name'
import { assertPlanPaths, inspectTarget } from './inspect'
import { mergeJson, mergeLines } from './merge'
import { discardStaging, stageFiles, writeIntoProject } from './write'

export type FileStatus = 'new' | 'overwrite' | 'keep' | 'merge'

export interface ClassifiedFile {
  /** For `merge`, `content` is the merged result that will be written. */
  file: PlannedFile
  status: FileStatus
  /** For `merge`: values of the user's file that were kept although the generated ones differ. */
  kept?: string[]
}

export interface ApplyOptions {
  yes: boolean
  force: boolean
  prompter: Prompter
  logger: Logger
  /** Where the staging directory is created; defaults to the OS temp directory. */
  tempRoot?: string
}

export interface ApplyResult {
  written: string[]
  overwritten: string[]
  kept: string[]
  /** Existing files that generation added to (task 1.3); their originals are backed up too. */
  merged: string[]
  /** What the summary should point out about merges, e.g. kept scripts. */
  notes: string[]
  /** Where the originals of overwritten or merged files were copied, if any were. */
  backupDir?: string
}

const CONFLICT_PREVIEW_LIMIT = 15

/** An existing file under a merge strategy: merged, unchanged, or a conflict if unmergeable. */
async function classifyMerge(plan: GenerationPlan, file: PlannedFile): Promise<ClassifiedFile> {
  const existing = await readFile(resolveInside(plan.projectDir, file.path), 'utf8')
  const merged =
    file.strategy === 'json-merge'
      ? mergeJson(existing, file.content)
      : { content: mergeLines(existing, file.content), kept: [] }
  if (merged === undefined) return { file, status: 'overwrite' }
  if (merged.content === existing) return { file, status: 'keep' }
  return { file: { ...file, content: merged.content }, status: 'merge', kept: merged.kept }
}

/** Read-only: how each planned file relates to what is already on disk. */
export async function classifyFiles(plan: GenerationPlan): Promise<ClassifiedFile[]> {
  assertPlanPaths(plan)
  return Promise.all(
    plan.files.map(async (file): Promise<ClassifiedFile> => {
      const state = await inspectTarget(plan.projectDir, file.path)
      if (state === 'absent') return { file, status: 'new' }
      if (file.strategy === 'skip-if-exists') return { file, status: 'keep' }
      if (file.strategy === 'json-merge' || file.strategy === 'line-merge') {
        return classifyMerge(plan, file)
      }
      return { file, status: 'overwrite' }
    })
  )
}

function mergeNotes(classified: readonly ClassifiedFile[]): string[] {
  return classified
    .filter((entry) => entry.status === 'merge' && (entry.kept ?? []).length > 0)
    .map(
      (entry) =>
        `${entry.file.path}: kept your ${(entry.kept ?? []).join(', ')} (generated values differ)`
    )
}

function conflictSummary(conflicts: readonly ClassifiedFile[]): string {
  const shown = conflicts.slice(0, CONFLICT_PREVIEW_LIMIT).map((entry) => `  ${entry.file.path}`)
  const hidden = conflicts.length - shown.length
  const lines = [`${conflicts.length} file(s) already exist:`, ...shown]
  if (hidden > 0) lines.push(`  …and ${hidden} more`)
  if (conflicts.some((entry) => entry.file.path === 'package.json')) {
    lines.push(
      'package.json is one of them: keeping yours means the generated scripts and dependencies are not added.'
    )
  }
  return lines.join('\n')
}

/**
 * Decides what happens to files that already exist (D-17): `--force` overwrites, `--yes` alone
 * never overwrites and stops before writing anything, and an interactive user chooses.
 */
async function resolveConflicts(
  conflicts: readonly ClassifiedFile[],
  options: ApplyOptions
): Promise<'overwrite' | 'skip'> {
  if (conflicts.length === 0 || options.force) {
    return 'overwrite'
  }
  const summary = conflictSummary(conflicts)
  if (options.yes) {
    throw new InputError(
      `${summary}\nNothing was written. Re-run with --force to overwrite them (originals are backed up), or use another directory.`
    )
  }
  options.logger.warn(summary)
  const choice = await options.prompter.select<'overwrite' | 'skip' | 'abort'>({
    message: 'Some files already exist. What should happen to them?',
    choices: [
      { value: 'skip', label: 'Keep my existing files', hint: 'write only the new ones' },
      { value: 'overwrite', label: 'Overwrite them', hint: 'originals are backed up first' },
      { value: 'abort', label: 'Abort without writing anything' }
    ],
    initialValue: 'skip'
  })
  if (choice === 'abort') {
    throw new Aborted('Aborted by user; nothing was written.')
  }
  return choice
}

/**
 * Writes the plan into the project directory. Every path is validated and every file staged before
 * the project is touched; nothing is ever deleted, and replaced files are backed up (D-54).
 */
export async function applyPlan(plan: GenerationPlan, options: ApplyOptions): Promise<ApplyResult> {
  const classified = await classifyFiles(plan)
  const conflicts = classified.filter((entry) => entry.status === 'overwrite')
  const decision = await resolveConflicts(conflicts, options)

  const entries = classified
    .filter(
      (entry) =>
        entry.status === 'new' ||
        entry.status === 'merge' ||
        (entry.status === 'overwrite' && decision === 'overwrite')
    )
    .map((entry) => ({ file: entry.file, replaces: entry.status !== 'new' }))
  const stagingDir = await stageFiles(
    entries.map((entry) => entry.file),
    options.tempRoot
  )
  const outcome = await writeIntoProject(plan, entries, stagingDir)
  await discardStaging(stagingDir, outcome)

  const kept = classified
    .filter(
      (entry) => entry.status === 'keep' || (entry.status === 'overwrite' && decision === 'skip')
    )
    .map((entry) => entry.file.path)
  const merged = classified.filter((entry) => entry.status === 'merge').map((e) => e.file.path)
  return {
    written: [...outcome.written].sort(),
    overwritten: outcome.overwritten.filter((filePath) => !merged.includes(filePath)).sort(),
    kept: kept.sort(),
    merged: merged.sort(),
    notes: mergeNotes(classified),
    backupDir: outcome.backupDir
  }
}
