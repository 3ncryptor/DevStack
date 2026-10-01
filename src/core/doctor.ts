import os from 'node:os'

import { execa } from 'execa'

import { PACKAGE_MANAGERS, type PackageManagerId } from '../adapters/package-manager/index'

/** Lowest Node.js the CLI supports; kept equal to `engines.node` in package.json by a test. */
export const MIN_NODE_VERSION = '22.12.0'

/** Node.js the generated projects need (`engines.node` of language-node, D-09). */
export const PROJECT_NODE_VERSION = '24.0.0'

/** How long one probe may take. A corepack shim may fetch its package manager on first use. */
const PROBE_TIMEOUT_MS = 10_000

export type CheckStatus = 'ok' | 'warn' | 'error'

export interface DoctorCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
  /** What to do about a warning or error. */
  hint?: string
}

/** Runs a command without a shell; resolves its trimmed stdout, or undefined if it failed. */
export type Probe = (command: string, args: readonly string[]) => Promise<string | undefined>

export interface EnvironmentReport {
  checks: DoctorCheck[]
  installedPackageManagers: ReadonlySet<PackageManagerId>
}

export interface InspectOptions {
  nodeVersion: string
  /** Docker is only checked when the stack uses it, or when `doctor` is run directly (A0.2). */
  includeDocker: boolean
}

export const systemProbe: Probe = async (command, args) => {
  try {
    const result = await execa(command, args, {
      reject: false,
      stdin: 'ignore',
      timeout: PROBE_TIMEOUT_MS,
      // Outside the user's folder: a corepack shim would read its package.json, could pin a
      // packageManager field into it, or fail on a different pinned manager.
      cwd: os.tmpdir(),
      // never wait on corepack's "download pnpm?" question, never write a pin
      env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', COREPACK_ENABLE_AUTO_PIN: '0' }
    })
    return result.exitCode === 0 ? result.stdout.trim() : undefined
  } catch {
    // a binary that is not on PATH is the expected "not installed" answer, not a failure
    return undefined
  }
}

function versionAtLeast(version: string, minimum: string): boolean {
  const parse = (value: string): number[] =>
    value
      .replace(/^v/, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const actual = parse(version)
  const required = parse(minimum)
  for (let index = 0; index < required.length; index += 1) {
    const difference = (actual[index] ?? 0) - (required[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}

function nodeCheck(nodeVersion: string): DoctorCheck {
  const supported = versionAtLeast(nodeVersion, MIN_NODE_VERSION)
  return {
    id: 'node',
    label: 'Node.js',
    status: supported ? 'ok' : 'error',
    detail: `v${nodeVersion.replace(/^v/, '')}`,
    hint: supported ? undefined : `Install Node.js ${MIN_NODE_VERSION} or newer.`
  }
}

async function packageManagerCheck(probe: Probe, id: PackageManagerId): Promise<DoctorCheck> {
  const version = await probe(id, ['--version'])
  return version === undefined
    ? {
        id: `pm-${id}`,
        label: id,
        status: 'warn',
        detail: 'not installed',
        hint: id === 'bun' ? 'See https://bun.sh to install bun.' : `Run: corepack enable ${id}`
      }
    : { id: `pm-${id}`, label: id, status: 'ok', detail: `v${version}` }
}

async function gitChecks(probe: Probe): Promise<DoctorCheck[]> {
  const version = await probe('git', ['--version'])
  if (version === undefined) {
    return [
      {
        id: 'git',
        label: 'git',
        status: 'warn',
        detail: 'not installed',
        hint: 'Install git, or pass --skip-git.'
      }
    ]
  }
  const [name, email] = await Promise.all([
    probe('git', ['config', 'user.name']),
    probe('git', ['config', 'user.email'])
  ])
  const missing = [...(name ? [] : ['user.name']), ...(email ? [] : ['user.email'])]
  const identity: DoctorCheck =
    missing.length === 0
      ? { id: 'git-identity', label: 'git identity', status: 'ok', detail: `${name} <${email}>` }
      : {
          id: 'git-identity',
          label: 'git identity',
          status: 'warn',
          detail: `${missing.join(' and ')} not set`,
          hint: missing.map((key) => `git config --global ${key} "<your ${key}>"`).join('; ')
        }
  return [
    { id: 'git', label: 'git', status: 'ok', detail: version.replace(/^git version /, 'v') },
    identity
  ]
}

export async function inspectDocker(probe: Probe): Promise<DoctorCheck> {
  const server = await probe('docker', ['info', '--format', '{{.ServerVersion}}'])
  if (server !== undefined) {
    return { id: 'docker', label: 'Docker', status: 'ok', detail: `engine v${server}` }
  }
  const installed = (await probe('docker', ['--version'])) !== undefined
  return {
    id: 'docker',
    label: 'Docker',
    status: 'warn',
    detail: installed ? 'installed but not running' : 'not installed',
    hint: installed
      ? 'Start Docker before running docker compose up.'
      : 'Install Docker to use the generated Dockerfile and compose file.'
  }
}

/** The environment checks behind `doctor` and the `init` pre-flight (D-44). Read-only. */
export async function inspectEnvironment(
  probe: Probe,
  options: InspectOptions
): Promise<EnvironmentReport> {
  const [packageManagers, git, docker] = await Promise.all([
    Promise.all(PACKAGE_MANAGERS.map((id) => packageManagerCheck(probe, id))),
    gitChecks(probe),
    options.includeDocker ? inspectDocker(probe).then((check) => [check]) : Promise.resolve([])
  ])
  const installedPackageManagers = new Set(
    PACKAGE_MANAGERS.filter((_id, index) => packageManagers[index]?.status === 'ok')
  )
  return {
    checks: [nodeCheck(options.nodeVersion), ...packageManagers, ...git, ...docker],
    installedPackageManagers
  }
}

export interface SelectionCheckInput {
  installedPackageManagers: ReadonlySet<PackageManagerId>
  packageManager: PackageManagerId
  skipInstall: boolean
  /** The Node.js that will install and run the project; checked against its engines field. */
  nodeVersion?: string
}

/** yarn (classic) enforces `engines` and stops the install; the others only warn. */
function projectNodeCheck(input: SelectionCheckInput): DoctorCheck[] {
  if (input.nodeVersion === undefined || versionAtLeast(input.nodeVersion, PROJECT_NODE_VERSION)) {
    return []
  }
  const major = PROJECT_NODE_VERSION.split('.')[0] ?? PROJECT_NODE_VERSION
  const blocks = input.packageManager === 'yarn' && !input.skipInstall
  return [
    {
      id: 'project-node',
      label: 'Node.js for the project',
      status: blocks ? 'error' : 'warn',
      detail: `generated projects need Node ${major}+, this is v${input.nodeVersion.replace(/^v/, '')}`,
      hint: blocks
        ? `yarn refuses to install on an older Node. Use Node ${major} (e.g. nvm install ${major}), another package manager, or --skip-install.`
        : `The project installs, but run it on Node ${major} or newer.`
    }
  ]
}

/** Checks that depend on the answers: fail before writing anything rather than mid-install. */
export function checkSelection(input: SelectionCheckInput): DoctorCheck[] {
  return [...projectNodeCheck(input), ...packageManagerInstalledCheck(input)]
}

function packageManagerInstalledCheck(input: SelectionCheckInput): DoctorCheck[] {
  if (input.skipInstall || input.installedPackageManagers.has(input.packageManager)) {
    return []
  }
  const installed = [...input.installedPackageManagers]
  return [
    {
      id: 'selected-pm',
      label: input.packageManager,
      status: 'error',
      detail: 'chosen for this project but not installed',
      hint:
        installed.length > 0
          ? `Install ${input.packageManager}, choose another with --pm (installed: ${installed.join(', ')}), or pass --skip-install.`
          : `Install ${input.packageManager}, or pass --skip-install.`
    }
  ]
}

export const hasErrors = (checks: readonly DoctorCheck[]): boolean =>
  checks.some((check) => check.status === 'error')

const MARK: Record<CheckStatus, string> = { ok: '✔', warn: '!', error: '✖' }

export function formatDoctorReport(checks: readonly DoctorCheck[]): string {
  return checks
    .flatMap((check) => [
      `${MARK[check.status]} ${check.label}: ${check.detail}`,
      ...(check.hint === undefined ? [] : [`    → ${check.hint}`])
    ])
    .join('\n')
}
