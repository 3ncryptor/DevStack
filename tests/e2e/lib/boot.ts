import net from 'node:net'

import {
  envelopeProblems,
  readyProblems,
  securityHeaderProblems,
  type ReadyExpectation
} from './checks'
import { describeExit, signalGroup, spawnGroup, type ExitStatus } from './process'

export interface BootResult {
  ok: boolean
  problems: string[]
  output: string
}

const POLL_INTERVAL_MS = 250
const REQUEST_TIMEOUT_MS = 2000
const SHUTDOWN_GRACE_MS = 15_000
const OUTPUT_TAIL_CHARS = 4000

/** Ports handed out in this run: combinations run concurrently and must not share one. */
const handedOut = new Set<number>()

/**
 * A port free on every address: the probe listens on the unspecified (dual-stack) address like
 * Next.js does, so a port another app holds on `::` is not mistaken for free.
 */
export async function findFreePort(): Promise<number> {
  const port = await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, () => {
      const address = server.address()
      const found = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(found))
    })
  })
  if (handedOut.has(port)) return findFreePort()
  handedOut.add(port)
  return port
}

function delay<T>(ms: number, value: T): { promise: Promise<T>; cancel: () => void } {
  let timer: NodeJS.Timeout | undefined
  const promise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(value), ms)
  })
  return { promise, cancel: () => clearTimeout(timer) }
}

/** Polls until /health answers 2xx, the app exits, or the deadline passes. */
export async function pollUntilHealthy(
  url: string,
  deadline: number,
  hasExited: () => boolean
): Promise<Response | undefined> {
  return pollHealth(url, deadline, hasExited)
}

async function pollHealth(
  url: string,
  deadline: number,
  hasExited: () => boolean
): Promise<Response | undefined> {
  while (Date.now() < deadline && !hasExited()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (response.ok) {
        return response
      }
    } catch {
      // not listening yet, or the request timed out; keep polling
    }
    const pause = delay(POLL_INTERVAL_MS, undefined)
    await pause.promise
  }
  return undefined
}

/**
 * Starts the generated app, checks GET /health and its security headers,
 * then sends SIGTERM to its process group and requires exit code 0 (graceful shutdown).
 * Callers pass the app's own command (not a package-manager wrapper) so the status is the app's.
 */
export interface BootOptions {
  timeoutMs: number
  /** Extra environment, e.g. the project's .env values (production never loads .env itself). */
  env: Record<string, string>
  ready: ReadyExpectation
  /** security-helmet is selected: its headers must be on every response. */
  helmet: boolean
}

const PROBE_REQUEST_ID = 'e2e-probe-1'

/** The golden-path routes (B17.2): readiness, error envelope and request id. */
async function probeGoldenPath(baseUrl: string, expected: ReadyExpectation): Promise<string[]> {
  try {
    const ready = await fetch(`${baseUrl}/ready`, { signal: AbortSignal.timeout(5000) })
    const missing = await fetch(`${baseUrl}/devstack-e2e-missing`, {
      headers: { 'x-request-id': PROBE_REQUEST_ID },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    return [
      ...readyProblems(ready.status, await ready.json(), expected),
      ...envelopeProblems(missing.status, await missing.json(), PROBE_REQUEST_ID),
      ...(missing.headers.get('x-request-id') === PROBE_REQUEST_ID
        ? []
        : ['x-request-id is not echoed on responses'])
    ]
  } catch (error: unknown) {
    return [`golden-path probe failed: ${error instanceof Error ? error.message : String(error)}`]
  }
}

export async function bootAndProbe(
  cwd: string,
  command: string,
  args: string[],
  options: BootOptions
): Promise<BootResult> {
  const { timeoutMs } = options
  const port = await findFreePort()
  const child = spawnGroup(command, args, cwd, {
    ...options.env,
    PORT: String(port),
    NODE_ENV: 'production'
  })

  let output = ''
  const append = (chunk: Buffer): void => {
    output = (output + chunk.toString()).slice(-OUTPUT_TAIL_CHARS)
  }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)

  let exitStatus: ExitStatus | undefined
  const exited = new Promise<ExitStatus>((resolve) => {
    child.once('exit', (code, signal) => {
      exitStatus = signal !== null ? { kind: 'signal', signal } : { kind: 'exit', code: code ?? 1 }
      resolve(exitStatus)
    })
  })

  const problems: string[] = []
  const url = `http://127.0.0.1:${port}/health`
  const response = await pollHealth(url, Date.now() + timeoutMs, () => exitStatus !== undefined)

  if (exitStatus !== undefined) {
    problems.push(`app exited before becoming healthy (${describeExit(exitStatus)})`)
    return { ok: false, problems, output }
  }
  if (response === undefined) {
    problems.push(`GET /health did not return 2xx within ${timeoutMs} ms`)
  } else {
    problems.push(...securityHeaderProblems(response.headers, options.helmet))
    problems.push(...(await probeGoldenPath(`http://127.0.0.1:${port}`, options.ready)))
  }

  const stopped = await stopGroup(child.pid, exited)
  if (stopped.kind !== 'exit' || stopped.code !== 0) {
    problems.push(`did not shut down cleanly on SIGTERM: ${describeExit(stopped)}`)
  }
  return { ok: problems.length === 0, problems, output }
}

export async function stopGroup(
  pid: number | undefined,
  exited: Promise<ExitStatus>
): Promise<ExitStatus> {
  signalGroup(pid, 'SIGTERM')
  const grace = delay<ExitStatus>(SHUTDOWN_GRACE_MS, { kind: 'timeout' })
  const result = await Promise.race([exited, grace.promise])
  grace.cancel()
  if (result.kind === 'timeout') {
    signalGroup(pid, 'SIGKILL')
  }
  return result
}
