import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { GenerationPlan, PlannedFile } from '../../types/plan'
import { assertPlanPaths, inspectTarget } from '../apply/inspect'
import { mergeJson, mergeLines } from '../apply/merge'
import { MANIFEST_PATH } from '../manifest'
import { resolveInside } from '../project-name'
import { appendEnv, mergeJson3, mergePnpmWorkspace } from './merge3'

/**
 * What `add` and `remove` do to each file (task 5.6), decided from three versions: the old plan
 * (what DevStack generated), the new plan (the stack after the change) and the disk (the
 * project as it is now). A file the user edited is never overwritten without --force.
 */
export type Change =
  | { kind: 'create'; file: PlannedFile }
  /** Generated, untouched since, and generation changed it: safe to replace. */
  | { kind: 'update'; file: PlannedFile }
  /** package.json, .gitignore, .env: the change applied inside the user's file. */
  | { kind: 'merge'; file: PlannedFile; kept: string[]; added?: string[] }
  /** Generated, untouched since, and no longer part of the stack. */
  | { kind: 'delete'; path: string }
  /** The user edited it (or created it) and generation changed it too. */
  | { kind: 'conflict'; file: PlannedFile; reason: 'edited' | 'exists' }
  /** Left alone, with the reason, e.g. edited and no longer generated. */
  | { kind: 'skip'; path: string; reason: string }

const ENV_FILE = /(^|\/)\.env$/
const PNPM_WORKSPACE = 'pnpm-workspace.yaml'

/** New build approvals into the user's pnpm-workspace.yaml; never anything else in it. */
function workspaceChange(file: PlannedFile, disk: string): Change | undefined {
  const merged = mergePnpmWorkspace(disk, file.content)
  if (merged === undefined) return { kind: 'conflict', file, reason: 'edited' }
  return merged.added.length === 0
    ? undefined
    : { kind: 'merge', file: { ...file, content: merged.content }, kept: [], added: merged.added }
}

async function readIfFile(projectDir: string, relativePath: string): Promise<string | undefined> {
  const state = await inspectTarget(projectDir, relativePath)
  if (state === 'absent') return undefined
  return readFile(resolveInside(projectDir, relativePath), 'utf8')
}

function mergedFile(
  file: PlannedFile,
  disk: string,
  old: PlannedFile | undefined
): Change | undefined {
  if (file.strategy === 'line-merge') {
    const content = mergeLines(disk, file.content)
    return content === disk ? undefined : { kind: 'merge', file: { ...file, content }, kept: [] }
  }
  const result =
    old === undefined ? mergeJson(disk, file.content) : mergeJson3(disk, old.content, file.content)
  if (result === undefined) return { kind: 'conflict', file, reason: 'edited' }
  return result.content === disk
    ? undefined
    : { kind: 'merge', file: { ...file, content: result.content }, kept: result.kept }
}

function envChange(file: PlannedFile, disk: string, note: string): Change | undefined {
  const appended = appendEnv(disk, file.content, note)
  return appended.added.length === 0
    ? undefined
    : {
        kind: 'merge',
        file: { ...file, content: appended.content },
        kept: [],
        added: appended.added
      }
}

/** One file the new plan writes. */
async function changeFor(
  file: PlannedFile,
  old: PlannedFile | undefined,
  projectDir: string,
  note: string
): Promise<Change | undefined> {
  const disk = await readIfFile(projectDir, file.path)
  // the manifest is DevStack's record of the stack: always the new one
  if (file.path === MANIFEST_PATH) {
    return disk === file.content ? undefined : { kind: 'update', file }
  }
  if (disk === undefined) {
    if (old !== undefined && old.content === file.content) return undefined
    return old !== undefined && file.strategy === 'create'
      ? { kind: 'skip', path: file.path, reason: 'you deleted it; not restored' }
      : { kind: 'create', file }
  }
  if (file.strategy === 'skip-if-exists') {
    if (file.path === PNPM_WORKSPACE) return workspaceChange(file, disk)
    return ENV_FILE.test(file.path) ? envChange(file, disk, note) : undefined
  }
  if (file.strategy === 'json-merge' || file.strategy === 'line-merge') {
    return mergedFile(file, disk, old)
  }
  if (disk === file.content) return undefined
  if (old === undefined) return { kind: 'conflict', file, reason: 'exists' }
  if (old.content === file.content) return undefined
  return disk === old.content
    ? { kind: 'update', file }
    : { kind: 'conflict', file, reason: 'edited' }
}

/** One file the old plan wrote and the new one does not. */
async function changeForRemoved(old: PlannedFile, projectDir: string): Promise<Change | undefined> {
  // README, .env, package.json and the like belong to the user once written
  if (old.strategy !== 'create') return undefined
  const disk = await readIfFile(projectDir, old.path)
  if (disk === undefined) return undefined
  return disk === old.content
    ? { kind: 'delete', path: old.path }
    : { kind: 'skip', path: old.path, reason: 'you changed it; delete it yourself if unused' }
}

export const pathOf = (change: Change): string =>
  'file' in change ? change.file.path : change.path

/** Every change, in path order; files no version changes are not listed. */
export async function reconcile(
  oldPlan: GenerationPlan,
  newPlan: GenerationPlan,
  note: string
): Promise<Change[]> {
  assertPlanPaths(newPlan)
  const oldFiles = new Map(oldPlan.files.map((file) => [file.path, file]))
  const newPaths = new Set(newPlan.files.map((file) => file.path))
  const changes = await Promise.all([
    ...newPlan.files.map((file) =>
      changeFor(file, oldFiles.get(file.path), newPlan.projectDir, note)
    ),
    ...oldPlan.files
      .filter((file) => !newPaths.has(file.path))
      .map((file) => changeForRemoved(file, newPlan.projectDir))
  ])
  return changes
    .filter((change): change is Change => change !== undefined)
    .sort((a, b) => pathOf(a).localeCompare(pathOf(b)))
}

/** Where a conflict's generated version is written for the user to merge by hand. */
export const sidecarPath = (filePath: string): string =>
  path.posix.join(path.posix.dirname(filePath), `${path.posix.basename(filePath)}.devstack-new`)
