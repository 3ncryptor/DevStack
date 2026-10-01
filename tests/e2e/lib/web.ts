import { findFreePort, pollUntilHealthy, stopGroup, type BootResult } from './boot'
import { describeExit, spawnGroup, type ExitStatus } from './process'

const OUTPUT_TAIL_CHARS = 4000

interface RunningApp {
  pid: number | undefined
  port: number
  exited: Promise<ExitStatus>
  hasExited: () => boolean
  output: () => string
}

function start(
  cwd: string,
  command: string[],
  env: Record<string, string>,
  port: number
): RunningApp {
  const [binary = '', ...args] = command
  const child = spawnGroup(binary, args, cwd, {
    ...env,
    PORT: String(port),
    NODE_ENV: 'production'
  })
  let output = ''
  let status: ExitStatus | undefined
  const append = (chunk: Buffer): void => {
    output = (output + chunk.toString()).slice(-OUTPUT_TAIL_CHARS)
  }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  const exited = new Promise<ExitStatus>((resolve) => {
    // a binary that cannot be started is a failed step, not a crashed harness
    child.once('error', (error) => {
      output += `\nfailed to start ${binary}: ${error.message}`
      status = { kind: 'exit', code: 127 }
      resolve(status)
    })
    child.once('exit', (code, signal) => {
      status = signal !== null ? { kind: 'signal', signal } : { kind: 'exit', code: code ?? 1 }
      resolve(status)
    })
  })
  return {
    pid: child.pid,
    port,
    exited,
    hasExited: () => status !== undefined,
    output: () => output
  }
}

/** Text of the status line, whatever markup React puts around it. */
function statusLine(html: string): string | undefined {
  const match = /data-testid="status"[^>]*>([^<]*)</.exec(html)
  return match?.[1]
}

export interface WebApp {
  name: string
  dir: string
  command: string[]
}

export interface FullstackOptions {
  apiDir: string
  apiCommand: string[]
  /** apps/web, and apps/admin when there is one (D-64). */
  webApps: readonly WebApp[]
  /** GET /v1 must answer the success envelope (D-64). */
  versioned: boolean
  env: Record<string, string>
  timeoutMs: number
  /** Whether the database is reachable, i.e. what the status page must say about it. */
  databaseUp: boolean
  hasDatabase: boolean
}

async function statusProblems(
  app: RunningApp,
  options: FullstackOptions,
  name: string
): Promise<string[]> {
  const html = await (await fetch(`http://127.0.0.1:${app.port}/`)).text()
  const line = statusLine(html) ?? ''
  const expected = [
    'API ✓ connected',
    ...(options.hasDatabase ? [options.databaseUp ? 'DB ✓ connected' : 'DB ✗ unreachable'] : [])
  ]
  return expected
    .filter((part) => !line.includes(part))
    .map((part) => `${name}: status page says "${line}", expected "${part}"`)
}

async function versionProblems(apiPort: number): Promise<string[]> {
  const response = await fetch(`http://127.0.0.1:${apiPort}/v1`)
  const body = (await response.json()) as { success?: unknown }
  return response.status === 200 && body.success === true
    ? []
    : [`GET /v1 returned ${response.status}, expected the success envelope`]
}

/**
 * B17.1 for a fullstack project: with the API running, every web app answers /health and its
 * home page shows "API ✓ connected" and the database state; all shut down cleanly on SIGTERM.
 */
export async function bootFullstack(options: FullstackOptions): Promise<BootResult> {
  const api = start(options.apiDir, options.apiCommand, options.env, await findFreePort())
  const webs: Array<{ name: string; app: RunningApp }> = []
  for (const web of options.webApps) {
    const app = start(
      web.dir,
      web.command,
      { API_URL: `http://127.0.0.1:${api.port}`, NEXT_TELEMETRY_DISABLED: '1' },
      await findFreePort()
    )
    webs.push({ name: web.name, app })
  }
  const problems: string[] = []
  const deadline = Date.now() + options.timeoutMs
  const apiUp = await pollUntilHealthy(
    `http://127.0.0.1:${api.port}/health`,
    deadline,
    api.hasExited
  )
  if (apiUp === undefined) problems.push('the API did not become healthy')
  if (apiUp !== undefined && options.versioned) problems.push(...(await versionProblems(api.port)))

  for (const { name, app } of webs) {
    const up = await pollUntilHealthy(
      `http://127.0.0.1:${app.port}/health`,
      deadline,
      app.hasExited
    )
    if (up === undefined) {
      problems.push(`${name} did not answer GET /health`)
    } else if (apiUp !== undefined) {
      problems.push(...(await statusProblems(app, options, name)))
    }
  }

  // `next start` ends with the conventional 143 (128 + SIGTERM) after a clean stop; the API is
  // DevStack's own code and must exit 0 (D-55, D-63)
  for (const { name, app } of webs) {
    const stopped = await stopGroup(app.pid, app.exited)
    if (stopped.kind !== 'exit' || ![0, 143].includes(stopped.code)) {
      problems.push(`${name} did not shut down cleanly on SIGTERM: ${describeExit(stopped)}`)
    }
  }
  const stopped = await stopGroup(api.pid, api.exited)
  if (stopped.kind !== 'exit' || stopped.code !== 0) {
    problems.push(`api did not shut down cleanly on SIGTERM: ${describeExit(stopped)}`)
  }
  const output = [
    `--- api ---\n${api.output()}`,
    ...webs.map(({ name, app }) => `--- ${name} ---\n${app.output()}`)
  ].join('\n')
  return { ok: problems.length === 0, problems, output }
}
