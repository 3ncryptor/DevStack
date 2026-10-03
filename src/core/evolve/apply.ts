import { copyFile, mkdir, readdir, rm, rmdir } from 'node:fs/promises'
import path from 'node:path'

import type { GenerationPlan } from '../../types/plan'
import { inspectTarget } from '../apply/inspect'
import { discardStaging, stageFiles, writeIntoProject, type WriteEntry } from '../apply/write'
import { formatWith, prettierConfigOf } from '../planner/format'
import { resolveInside } from '../project-name'
import { sidecarPath, type Change } from './reconcile'

export interface EvolveOutcome {
  written: string[]
  deleted: string[]
  /** Generated versions of edited files, next to them as `<file>.devstack-new`. */
  sidecars: string[]
  /** Where the originals of replaced and deleted files were copied, if any were. */
  backupDir?: string
}

const SIDECAR_SUFFIX = '.devstack-new'

/** What to write: new and updated files, merges, and each conflict as a sidecar (or, forced, in place). */
function writeEntries(changes: readonly Change[], force: boolean): WriteEntry[] {
  return changes.flatMap((change): WriteEntry[] => {
    if (change.kind === 'create') return [{ file: change.file, replaces: false }]
    if (change.kind === 'update' || change.kind === 'merge') {
      return [{ file: change.file, replaces: true }]
    }
    if (change.kind === 'conflict') {
      return force
        ? [{ file: change.file, replaces: true }]
        : [{ file: { ...change.file, path: sidecarPath(change.file.path) }, replaces: false }]
    }
    return []
  })
}

/** Merged JSON comes out of JSON.stringify; the project's own Prettier config formats it. */
async function formatEntries(plan: GenerationPlan, entries: WriteEntry[]): Promise<WriteEntry[]> {
  const config = prettierConfigOf(plan.files)
  if (config === undefined) return entries
  const files = await formatWith(
    entries.map((entry) => entry.file),
    config
  )
  return entries.map((entry, index) => ({ ...entry, file: files[index] ?? entry.file }))
}

/** A sidecar left by an earlier run is DevStack's own file, so it may be replaced. */
function replacingOldSidecars(plan: GenerationPlan, entries: WriteEntry[]): Promise<WriteEntry[]> {
  return Promise.all(
    entries.map(async (entry) =>
      entry.file.path.endsWith(SIDECAR_SUFFIX) &&
      (await inspectTarget(plan.projectDir, entry.file.path)) === 'file'
        ? { ...entry, replaces: true }
        : entry
    )
  )
}

/** Removes the directories a deletion left empty, never the project root itself. */
async function removeEmptyParents(projectDir: string, relativePath: string): Promise<void> {
  let directory = path.posix.dirname(relativePath)
  while (directory !== '.' && directory !== '') {
    const absolute = resolveInside(projectDir, directory)
    const entries = await readdir(absolute)
    if (entries.length > 0) return
    await rmdir(absolute)
    directory = path.posix.dirname(directory)
  }
}

/** Backs a file up into the staging folder, then deletes it. */
async function deleteWithBackup(
  projectDir: string,
  relativePath: string,
  backupRoot: string
): Promise<void> {
  if ((await inspectTarget(projectDir, relativePath)) !== 'file') return
  const target = resolveInside(projectDir, relativePath)
  const backup = resolveInside(backupRoot, relativePath)
  await mkdir(path.dirname(backup), { recursive: true })
  await copyFile(target, backup)
  await rm(target)
  await removeEmptyParents(projectDir, relativePath)
}

/**
 * Applies the changes (task 5.6): everything is staged first and every original is backed up,
 * whether it is replaced or deleted, so nothing the user had is ever lost (D-54).
 */
export async function applyChanges(
  plan: GenerationPlan,
  changes: readonly Change[],
  options: { force: boolean; tempRoot?: string }
): Promise<EvolveOutcome> {
  const entries = await replacingOldSidecars(
    plan,
    await formatEntries(plan, writeEntries(changes, options.force))
  )
  const stagingDir = await stageFiles(
    entries.map((entry) => entry.file),
    options.tempRoot
  )
  const outcome = await writeIntoProject(plan, entries, stagingDir)
  const backupDir = path.join(stagingDir, 'backup')
  const deletions = changes.flatMap((change) => (change.kind === 'delete' ? [change.path] : []))
  for (const relativePath of deletions) {
    await deleteWithBackup(plan.projectDir, relativePath, backupDir)
  }
  const backedUp = outcome.backupDir !== undefined || deletions.length > 0
  await discardStaging(stagingDir, backedUp ? { ...outcome, backupDir } : outcome)
  return {
    written: outcome.written.filter((file) => !file.endsWith(SIDECAR_SUFFIX)),
    deleted: deletions,
    sidecars: outcome.written.filter((file) => file.endsWith(SIDECAR_SUFFIX)),
    ...(backedUp ? { backupDir } : {})
  }
}
