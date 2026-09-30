import type { Stats } from 'node:fs'
import { lstat } from 'node:fs/promises'
import path from 'node:path'

import { ApplyError, InputError } from '../../errors'
import type { GenerationPlan } from '../../types/plan'
import { resolveInside } from '../project-name'

/** What is on disk at a planned path. Anything else (symlink, directory, device) is refused. */
export type TargetState = 'absent' | 'file'

async function lstatIfPresent(target: string): Promise<Stats | undefined> {
  try {
    return await lstat(target)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw new ApplyError(`Cannot inspect ${target}: ${(error as Error).message}`, { cause: error })
  }
}

/**
 * Walks every path segment below the project directory with lstat, never following links.
 * A symlink at the path or at any ancestor is refused, so writes cannot land outside the project
 * and a dangling link can never be mistaken for a free path.
 */
export async function inspectTarget(
  projectDir: string,
  relativePath: string
): Promise<TargetState> {
  const base = path.resolve(projectDir)
  const target = resolveInside(base, relativePath)
  const segments = path.relative(base, target).split(path.sep)

  let current = base
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment)
    const shown = path.relative(base, current)
    const stats = await lstatIfPresent(current)
    if (stats === undefined) {
      return 'absent'
    }
    if (stats.isSymbolicLink()) {
      throw new InputError(`Refusing to write ${relativePath}: ${shown} is a symbolic link.`)
    }
    const isLast = index === segments.length - 1
    if (!isLast && !stats.isDirectory()) {
      throw new InputError(
        `Refusing to write ${relativePath}: ${shown} is a file, not a directory.`
      )
    }
    if (isLast && !stats.isFile()) {
      throw new InputError(
        `Refusing to write ${relativePath}: it exists and is not a regular file.`
      )
    }
  }
  return 'file'
}

/**
 * Planned paths must be normalised, non-empty, relative, and unique even on case-insensitive
 * filesystems, so two plan entries can never silently target the same file.
 */
export function assertPlanPaths(plan: GenerationPlan): void {
  const seen = new Map<string, string>()
  for (const file of plan.files) {
    const normalised = path.posix.normalize(file.path)
    if (
      file.path === '' ||
      normalised !== file.path ||
      file.path.endsWith('/') ||
      normalised === '.'
    ) {
      throw new InputError(`Planned path "${file.path}" is not a normalised relative file path.`)
    }
    const key = normalised.toLowerCase()
    const previous = seen.get(key)
    if (previous !== undefined) {
      throw new InputError(
        `Planned paths "${previous}" and "${file.path}" would write the same file.`
      )
    }
    seen.set(key, file.path)
    resolveInside(plan.projectDir, file.path)
  }
}
