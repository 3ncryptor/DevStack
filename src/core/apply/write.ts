import { constants } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { ApplyError } from '../../errors'
import type { GenerationPlan, PlannedFile } from '../../types/plan'
import { resolveInside } from '../project-name'
import { inspectTarget } from './inspect'

const EXECUTABLE_BITS = 0o111

export interface WriteEntry {
  file: PlannedFile
  replaces: boolean
}

export interface WriteOutcome {
  written: string[]
  overwritten: string[]
  backupDir?: string
}

/** Renders every file into a fresh staging directory, so a failure here touches nothing. */
export async function stageFiles(files: readonly PlannedFile[]): Promise<string> {
  const stagingDir = await mkdtemp(path.join(os.tmpdir(), 'devstack-stage-'))
  for (const file of files) {
    const target = resolveInside(path.join(stagingDir, 'files'), file.path)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.content, { mode: file.mode })
  }
  return stagingDir
}

/** Copies a file the user already has into the staging backup folder before it is replaced. */
async function backUp(stagingDir: string, target: string, relativePath: string): Promise<number> {
  const backup = resolveInside(path.join(stagingDir, 'backup'), relativePath)
  await mkdir(path.dirname(backup), { recursive: true })
  await copyFile(target, backup)
  const { mode } = await stat(target)
  await chmod(backup, mode & 0o777)
  return mode & 0o777
}

async function writeOne(
  plan: GenerationPlan,
  entry: WriteEntry,
  stagingDir: string
): Promise<void> {
  const { file } = entry
  const target = resolveInside(plan.projectDir, file.path)
  const staged = path.join(stagingDir, 'files', file.path)
  const state = await inspectTarget(plan.projectDir, file.path) // re-checked right before writing

  if (entry.replaces && state === 'file') {
    const existingMode = await backUp(stagingDir, target, file.path)
    await copyFile(staged, target)
    // keep the user's permissions (e.g. 0600); only add execute bits a hook needs
    await chmod(target, existingMode | (file.mode & EXECUTABLE_BITS))
    return
  }
  await mkdir(path.dirname(target), { recursive: true })
  // exclusive: a file that appeared after classification is never clobbered
  await copyFile(staged, target, constants.COPYFILE_EXCL)
  await chmod(target, file.mode)
}

function failureMessage(entry: WriteEntry, outcome: WriteOutcome, stagingDir: string): string {
  return [
    `Writing ${entry.file.path} failed; it may be partially written.`,
    `Written before the failure (${outcome.written.length}): ${outcome.written.join(', ') || 'none'}.`,
    `Of those, replaced existing files: ${outcome.overwritten.join(', ') || 'none'}.`,
    `Originals of replaced files and the full generated copy are in ${stagingDir}.`
  ].join('\n')
}

/** Copies staged files into the project. Never deletes; backs up every file it replaces. */
export async function writeIntoProject(
  plan: GenerationPlan,
  entries: readonly WriteEntry[],
  stagingDir: string
): Promise<WriteOutcome> {
  const outcome: WriteOutcome = { written: [], overwritten: [] }
  for (const entry of entries) {
    try {
      await writeOne(plan, entry, stagingDir)
    } catch (error: unknown) {
      if (error instanceof ApplyError) throw error
      throw new ApplyError(`${failureMessage(entry, outcome, stagingDir)}\n${String(error)}`, {
        cause: error
      })
    }
    outcome.written.push(entry.file.path)
    if (entry.replaces) {
      outcome.overwritten.push(entry.file.path)
      outcome.backupDir = path.join(stagingDir, 'backup')
    }
  }
  return outcome
}
