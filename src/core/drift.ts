import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { PackageJson } from '../types/package-json'
import type { GenerationPlan } from '../types/plan'
import type { DoctorCheck } from './doctor'

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'] as const

/** A package the project pins differently from the catalog of this DevStack version. */
export interface Drift {
  file: string
  name: string
  project: string
  catalog: string
}

async function readPackageJson(file: string): Promise<PackageJson | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as PackageJson
  } catch {
    return undefined
  }
}

/**
 * Catalog drift (D-93): the project's package.json files against the same project planned with
 * today's catalog. Only planned packages are compared, so the user's own additions never count;
 * nothing is changed.
 */
export async function catalogDrift(plan: GenerationPlan): Promise<Drift[]> {
  const manifests = plan.files.filter((file) => path.posix.basename(file.path) === 'package.json')
  const drifts = await Promise.all(
    manifests.map(async (file) => {
      const onDisk = await readPackageJson(path.join(plan.projectDir, file.path))
      if (onDisk === undefined) return []
      const planned = JSON.parse(file.content) as PackageJson
      return DEPENDENCY_FIELDS.flatMap((field) =>
        Object.entries(planned[field] ?? {}).flatMap(([name, catalog]) => {
          const project = onDisk[field]?.[name]
          return project === undefined || project === catalog
            ? []
            : [{ file: file.path, name, project, catalog }]
        })
      )
    })
  )
  return drifts.flat()
}

export function driftCheck(drifts: readonly Drift[]): DoctorCheck {
  const base = { id: 'catalog-drift', label: 'Catalog' }
  if (drifts.length === 0) {
    return { ...base, status: 'ok', detail: "dependencies match this DevStack version's catalog" }
  }
  return {
    ...base,
    status: 'warn',
    detail: [
      `${drifts.length} differ from this DevStack version's catalog:`,
      ...drifts.map(
        (drift) => `    ${drift.name} ${drift.project} → ${drift.catalog} (${drift.file})`
      )
    ].join('\n'),
    hint: 'Nothing changes on its own: update when you are ready, then run the project checks.'
  }
}
