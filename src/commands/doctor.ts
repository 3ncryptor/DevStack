import { access } from 'node:fs/promises'
import path from 'node:path'

import { EXIT_CODE } from '../errors'
import {
  formatDoctorReport,
  hasErrors,
  inspectEnvironment,
  type DoctorCheck,
  type Probe
} from '../core/doctor'
import { catalogDrift, driftCheck } from '../core/drift'
import { planProject, readProjectStack } from '../core/evolve/project'
import { MANIFEST_PATH } from '../core/manifest'
import { loadModules } from '../core/module-loader'

/** In a DevStack project's root folder: its dependencies against today's catalog (D-93). */
async function projectChecks(projectDir: string): Promise<DoctorCheck[]> {
  const isProject = await access(path.join(projectDir, MANIFEST_PATH)).then(
    () => true,
    () => false
  )
  if (!isProject) return []
  const stack = await readProjectStack(projectDir)
  const plan = await planProject(stack, stack.modules, stack.moduleOptions, loadModules())
  return [driftCheck(await catalogDrift(plan))]
}

/** `doctor`: every environment check, Docker included, and catalog drift in a project. */
export async function runDoctor(
  probe: Probe,
  write: (line: string) => void,
  projectDir = process.cwd()
): Promise<number> {
  const report = await inspectEnvironment(probe, {
    nodeVersion: process.versions.node,
    includeDocker: true
  })
  const checks = [...report.checks, ...(await projectChecks(projectDir))]
  write(formatDoctorReport(checks))
  return hasErrors(checks) ? EXIT_CODE.invalidInput : EXIT_CODE.ok
}
