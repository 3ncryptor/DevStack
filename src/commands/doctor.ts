import { EXIT_CODE } from '../errors'
import { formatDoctorReport, hasErrors, inspectEnvironment, type Probe } from '../core/doctor'

/** `doctor`: every environment check, Docker included. Returns the exit code. */
export async function runDoctor(probe: Probe, write: (line: string) => void): Promise<number> {
  const report = await inspectEnvironment(probe, {
    nodeVersion: process.versions.node,
    includeDocker: true
  })
  write(formatDoctorReport(report.checks))
  return hasErrors(report.checks) ? EXIT_CODE.invalidInput : EXIT_CODE.ok
}
