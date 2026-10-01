import { realpathSync } from 'node:fs'
import os from 'node:os'

import { describe, expect, it } from 'vitest'

import {
  checkSelection,
  formatDoctorReport,
  hasErrors,
  inspectEnvironment,
  MIN_NODE_VERSION,
  PROJECT_NODE_VERSION,
  systemProbe,
  type Probe
} from '../src/core/doctor'
import { CLI_PACKAGE } from '../src/core/manifest'
import languageNode from '../src/modules/language-node/index'

/** A probe that answers from a table; anything not listed behaves like a missing binary. */
function fakeProbe(answers: Record<string, string>): Probe & { calls: string[] } {
  const calls: string[] = []
  const probe = (command: string, args: readonly string[]): Promise<string | undefined> => {
    const key = [command, ...args].join(' ')
    calls.push(key)
    return Promise.resolve(answers[key])
  }
  return Object.assign(probe, { calls })
}

const HEALTHY: Record<string, string> = {
  'npm --version': '11.6.0',
  'pnpm --version': '10.18.0',
  'git --version': 'git version 2.51.0',
  'git config user.name': 'Ada',
  'git config user.email': 'ada@example.com',
  'docker info --format {{.ServerVersion}}': '28.4.0'
}

const without = (key: string, answers = HEALTHY): Record<string, string> =>
  Object.fromEntries(Object.entries(answers).filter(([name]) => name !== key))

const status = (checks: readonly { id: string; status: string }[]): Record<string, string> =>
  Object.fromEntries(checks.map((check) => [check.id, check.status]))

describe('inspectEnvironment', () => {
  it('reports a healthy machine and which package managers are installed', async () => {
    const report = await inspectEnvironment(fakeProbe(HEALTHY), {
      nodeVersion: '24.9.0',
      includeDocker: true
    })

    expect(status(report.checks)).toEqual({
      node: 'ok',
      'pm-npm': 'ok',
      'pm-pnpm': 'ok',
      'pm-yarn': 'warn',
      'pm-bun': 'warn',
      git: 'ok',
      'git-identity': 'ok',
      docker: 'ok'
    })
    expect([...report.installedPackageManagers].sort()).toEqual(['npm', 'pnpm'])
    expect(hasErrors(report.checks)).toBe(false)
  })

  it.each([
    ['20.11.0', 'error'],
    ['22.11.9', 'error'],
    ['22.12.0', 'ok'],
    ['23.0.0', 'ok']
  ])('Node %s is %s', async (nodeVersion, expected) => {
    const report = await inspectEnvironment(fakeProbe(HEALTHY), {
      nodeVersion,
      includeDocker: false
    })

    expect(status(report.checks).node).toBe(expected)
  })

  it('warns when git identity is missing, naming the command that sets it', async () => {
    const report = await inspectEnvironment(fakeProbe(without('git config user.email')), {
      nodeVersion: '24.9.0',
      includeDocker: false
    })
    const identity = report.checks.find((check) => check.id === 'git-identity')

    expect(identity?.status).toBe('warn')
    expect(identity?.hint).toContain('git config --global user.email')
  })

  it('tells "Docker not installed" apart from "Docker not running"', async () => {
    const stopped = without('docker info --format {{.ServerVersion}}')
    const notRunning = await inspectEnvironment(
      fakeProbe({ ...stopped, 'docker --version': 'Docker version 28.4.0' }),
      { nodeVersion: '24.9.0', includeDocker: true }
    )
    const missing = await inspectEnvironment(fakeProbe(stopped), {
      nodeVersion: '24.9.0',
      includeDocker: true
    })

    expect(notRunning.checks.find((check) => check.id === 'docker')?.detail).toContain(
      'not running'
    )
    expect(missing.checks.find((check) => check.id === 'docker')?.detail).toContain('not installed')
  })

  it('does not touch Docker unless asked', async () => {
    const probe = fakeProbe(HEALTHY)
    await inspectEnvironment(probe, { nodeVersion: '24.9.0', includeDocker: false })

    expect(probe.calls.some((call) => call.startsWith('docker'))).toBe(false)
  })

  it('keeps MIN_NODE_VERSION in step with the engines field of package.json', () => {
    const engines = (CLI_PACKAGE as { engines?: { node?: string } }).engines?.node

    expect(engines).toBe(`>=${MIN_NODE_VERSION}`)
  })
})

describe('systemProbe', () => {
  it('runs outside the current folder, so corepack never reads or pins its package.json', async () => {
    const cwd = await systemProbe(process.execPath, ['-p', 'process.cwd()'])
    const autoPin = await systemProbe(process.execPath, [
      '-p',
      'process.env.COREPACK_ENABLE_AUTO_PIN'
    ])

    expect(cwd).toBe(realpathSync(os.tmpdir()))
    expect(autoPin).toBe('0')
  })

  it('reports a missing binary as undefined', async () => {
    expect(await systemProbe('devstack-no-such-binary', ['--version'])).toBeUndefined()
  })
})

describe('checkSelection', () => {
  const installedPackageManagers = new Set(['npm', 'pnpm'] as const)

  it('fails when the chosen package manager is missing and install will run', () => {
    const checks = checkSelection({
      installedPackageManagers,
      packageManager: 'bun',
      skipInstall: false
    })

    expect(hasErrors(checks)).toBe(true)
    expect(checks[0]?.hint).toContain('--pm')
  })

  it('accepts a missing package manager when install is skipped', () => {
    expect(
      hasErrors(
        checkSelection({ installedPackageManagers, packageManager: 'bun', skipInstall: true })
      )
    ).toBe(false)
  })

  it('accepts an installed package manager', () => {
    expect(
      checkSelection({ installedPackageManagers, packageManager: 'pnpm', skipInstall: false })
    ).toEqual([])
  })
})

describe('checkSelection: Node for the generated project', () => {
  const installedPackageManagers = new Set(['npm', 'yarn'] as const)
  const statuses = (nodeVersion: string, packageManager: 'npm' | 'yarn', skipInstall = false) =>
    checkSelection({ installedPackageManagers, packageManager, skipInstall, nodeVersion }).map(
      (check) => check.status
    )

  it('fails for yarn, which refuses to install when engines.node is not met', () => {
    expect(statuses('22.23.3', 'yarn')).toEqual(['error'])
  })

  it('warns for the others, which install anyway', () => {
    expect(statuses('22.23.3', 'npm')).toEqual(['warn'])
    expect(statuses('22.23.3', 'yarn', true)).toEqual(['warn'])
  })

  it('says nothing on a new enough Node', () => {
    expect(statuses(PROJECT_NODE_VERSION, 'yarn')).toEqual([])
  })

  it('keeps PROJECT_NODE_VERSION in step with the generated engines field', () => {
    const engines = languageNode.packageJson?.engines?.node

    expect(engines).toBe(`>=${PROJECT_NODE_VERSION.split('.')[0]}`)
  })
})

describe('formatDoctorReport', () => {
  it('prints one line per check with its hint', async () => {
    const report = await inspectEnvironment(fakeProbe(HEALTHY), {
      nodeVersion: '20.0.0',
      includeDocker: false
    })
    const text = formatDoctorReport(report.checks)

    expect(text).toContain('✖ Node.js')
    expect(text).toContain('✔ git')
    expect(text).toContain(`→ Install Node.js ${MIN_NODE_VERSION} or newer`)
  })
})
