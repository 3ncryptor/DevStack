import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'

import type { GenerationPlan } from '../../types/plan'
import { startProcess, type RunningProcess } from '../../utils/process'
import { plannedScripts } from './verify'
import { appDir } from '../settings'

const BOOT_TIMEOUT_MS = 30_000
const SHUTDOWN_GRACE_MS = 15_000
const POLL_INTERVAL_MS = 250
const REQUEST_TIMEOUT_MS = 2_000
/** A start script must be a plain command: it is run directly, never through a shell. */
const PLAIN_COMMAND = /^[\w./@=:-]+(\s+[\w./@=:-]+)*$/

export interface BootReport {
  ok: boolean
  problems: string[]
  /** What /ready said, e.g. "db: not ready (start it with db:up)". */
  readiness: string[]
  booted: string[]
}

interface App {
  name: string
  dir: string
  web: boolean
}

/** The apps to boot: the API (or the single app), then each web app against it. */
export function appsToBoot(plan: GenerationPlan): App[] {
  const has = (dir: string): boolean => plannedScripts(plan, dir).start !== undefined
  const api = appDir(plan.settings, 'backend')
  if (!plan.files.some((file) => file.path === `${api}/package.json`)) {
    return has('') ? [{ name: 'app', dir: '', web: false }] : []
  }
  return [
    ...(has(api) ? [{ name: plan.settings.apps.backend, dir: api, web: false }] : []),
    ...(['frontend', 'admin'] as const)
      .map((role) => ({ name: plan.settings.apps[role], dir: appDir(plan.settings, role) }))
      .filter((app) => has(app.dir))
      .map((app) => ({ ...app, web: true }))
  ]
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHealth(url: string, process: RunningProcess): Promise<boolean> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS
  while (Date.now() < deadline && !process.hasExited()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (response.ok) return true
    } catch {
      // not listening yet: keep polling until the deadline
    }
    await pause(POLL_INTERVAL_MS)
  }
  return false
}

function localBinary(projectDir: string, appDir: string, binary: string): string {
  for (const dir of [appDir, projectDir]) {
    const local = path.join(dir, 'node_modules', '.bin', binary)
    if (existsSync(local)) return local
  }
  return binary
}

async function appEnv(dir: string): Promise<Record<string, string>> {
  const file = path.join(dir, '.env')
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    Object.entries(parseEnv(await readFile(file, 'utf8'))).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
}

async function readinessOf(port: number): Promise<string[]> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/ready`, {
      signal: AbortSignal.timeout(5000)
    })
    const body = (await response.json()) as { checks?: Record<string, string> }
    return Object.entries(body.checks ?? {}).map(([name, status]) =>
      status === 'ok' ? `${name}: ready` : `${name}: not ready (expected until it is started)`
    )
  } catch {
    // an app without /ready (no golden path) simply has nothing to report
    return []
  }
}

async function stop(
  running: RunningProcess,
  accepted: readonly number[]
): Promise<string | undefined> {
  running.signal('SIGTERM')
  const status = await Promise.race([
    running.exited,
    pause(SHUTDOWN_GRACE_MS).then(() => undefined)
  ])
  if (status === undefined) {
    running.signal('SIGKILL')
    return `did not stop within ${SHUTDOWN_GRACE_MS / 1000}s of SIGTERM`
  }
  if (status.code !== null && accepted.includes(status.code)) return undefined
  return `exited with ${status.code === null ? `signal ${status.signal ?? '?'}` : `code ${status.code}`} on SIGTERM`
}

const EXIT_SIGNALS = ['SIGINT', 'SIGTERM'] as const

/**
 * Booted apps run in their own process groups, so a Ctrl-C or a SIGTERM to the CLI would leave
 * them running; while they are up, either signal kills them first, then exits as the signal would.
 */
function killOnExitSignal(started: ReadonlyArray<{ running: RunningProcess }>): () => void {
  const handlers = EXIT_SIGNALS.map((signal) => {
    const handler = (): void => {
      for (const { running } of started) running.signal('SIGKILL')
      process.exit(128 + os.constants.signals[signal])
    }
    process.once(signal, handler)
    return [signal, handler] as const
  })
  return () => {
    for (const [signal, handler] of handlers) process.off(signal, handler)
  }
}

/**
 * Boot verification (A0.4 step 3, B18): each app starts in production mode, answers /health,
 * and shuts down cleanly on SIGTERM. /ready is reported, not required: data services may not
 * be running yet.
 */
export async function bootCheck(plan: GenerationPlan): Promise<BootReport> {
  const report: BootReport = { ok: true, problems: [], readiness: [], booted: [] }
  const started: Array<{ app: App; running: RunningProcess }> = []
  let apiPort: number | undefined
  const releaseSignals = killOnExitSignal(started)
  try {
    for (const app of appsToBoot(plan)) {
      const start = plannedScripts(plan, app.dir).start ?? ''
      if (!PLAIN_COMMAND.test(start)) {
        report.problems.push(
          `${app.name}: start script is not a plain command, so it was not booted`
        )
        continue
      }
      const appDir = path.join(plan.projectDir, app.dir)
      const [binary = '', ...args] = start.split(/\s+/)
      const port = await freePort()
      const env = {
        ...(await appEnv(appDir)),
        PORT: String(port),
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        ...(app.web && apiPort !== undefined ? { API_URL: `http://127.0.0.1:${apiPort}` } : {})
      }
      const running = startProcess(localBinary(plan.projectDir, appDir, binary), args, {
        cwd: appDir,
        env
      })
      started.push({ app, running })
      if (!(await waitForHealth(`http://127.0.0.1:${port}/health`, running))) {
        report.problems.push(
          `${app.name}: GET /health did not answer within ${BOOT_TIMEOUT_MS / 1000}s\n${running.output()}`
        )
        break
      }
      report.booted.push(app.name)
      if (!app.web) {
        apiPort = port
        report.readiness.push(...(await readinessOf(port)))
      }
    }
  } finally {
    // stop in reverse order: web apps first, then the API they call
    for (const { app, running } of [...started].reverse()) {
      // Next.js ends with 143 after a clean SIGTERM stop; DevStack's own API exits 0 (D-55, D-63)
      const problem = await stop(running, app.web ? [0, 143] : [0])
      if (problem !== undefined)
        report.problems.push(`${app.name}: ${problem}\n${running.output()}`)
    }
    releaseSignals()
  }
  report.ok = report.problems.length === 0
  return report
}
