import net from 'node:net'

import { securityHeaderProblems } from './checks'
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

export async function findFreePort(): Promise<number> {
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

function delay<T>(ms: number, value: T): { promise: Promise<T>; cancel: () => void } {
  let timer: NodeJS.Timeout | undefined
  const promise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(value), ms)
  })
  return { promise, cancel: () => clearTimeout(timer) }
}

/** Polls until /health answers 2xx, the app exits, or the deadline passes. */
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
 * The status observed is the start script's (e.g. `npm run start`), which npm and pnpm
 * derive from the app's own exit.
 */
export async function bootAndProbe(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number
): Promise<BootResult> {
  const port = await findFreePort()
  const child = spawnGroup(command, args, cwd, { PORT: String(port), NODE_ENV: 'production' })

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
    problems.push(...securityHeaderProblems(response.headers))
  }

  const stopped = await stopGroup(child.pid, exited)
  if (stopped.kind !== 'exit' || stopped.code !== 0) {
    problems.push(`did not shut down cleanly on SIGTERM: ${describeExit(stopped)}`)
  }
  return { ok: problems.length === 0, problems, output }
}

async function stopGroup(
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
