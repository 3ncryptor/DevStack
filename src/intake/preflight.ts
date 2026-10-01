import type { PackageManagerId } from '../adapters/package-manager/index'
import {
  checkSelection,
  formatDoctorReport,
  hasErrors,
  inspectDocker,
  inspectEnvironment,
  type DoctorCheck,
  type EnvironmentReport,
  type Probe
} from '../core/doctor'
import { InputError } from '../errors'
import type { Logger } from '../utils/logger'

/** Fails on errors; prints warnings. A missing yarn or bun is normal, so those stay in --verbose. */
function report(checks: readonly DoctorCheck[], logger: Logger, heading: string): void {
  const problems = checks.filter((check) => check.status !== 'ok')
  if (hasErrors(checks)) {
    throw new InputError(`${heading} failed:\n${formatDoctorReport(problems)}`)
  }
  const warnings = problems.filter((check) => !check.id.startsWith('pm-'))
  if (warnings.length > 0) {
    logger.warn(formatDoctorReport(warnings))
  }
  logger.debug(formatDoctorReport(checks))
}

/** The doctor checks `init` runs before the first question (D-44). */
export async function runPreflight(probe: Probe, logger: Logger): Promise<EnvironmentReport> {
  const environment = await inspectEnvironment(probe, {
    nodeVersion: process.versions.node,
    includeDocker: false
  })
  report(environment.checks, logger, 'Pre-flight check')
  return environment
}

export interface SelectionPreflight {
  packageManager: PackageManagerId
  skipInstall: boolean
  usesDocker: boolean
}

/** Checks that need the answers: run before anything is written, so failures cost nothing. */
export async function checkAnswers(
  probe: Probe,
  environment: EnvironmentReport,
  selection: SelectionPreflight,
  logger: Logger
): Promise<void> {
  const checks = [
    ...checkSelection({
      installedPackageManagers: environment.installedPackageManagers,
      packageManager: selection.packageManager,
      skipInstall: selection.skipInstall,
      nodeVersion: process.versions.node
    }),
    ...(selection.usesDocker ? [await inspectDocker(probe)] : [])
  ]
  report(checks, logger, 'Check of your answers')
}
