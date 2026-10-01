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

export interface FullstackOptions {
  apiDir: string
  apiCommand: string[]
  webDir: string
  webCommand: string[]
  env: Record<string, string>
  timeoutMs: number
  /** Whether the database is reachable, i.e. what the status page must say about it. */
  databaseUp: boolean
  hasDatabase: boolean
}

/**
 * B17.1 for a fullstack project: with the API running, the web app answers /health and its home
 * page shows "API ✓ connected" and the database state; both shut down cleanly on SIGTERM.
 */
export async function bootFullstack(options: FullstackOptions): Promise<BootResult> {
  const api = start(options.apiDir, options.apiCommand, options.env, await findFreePort())
  const web = start(
    options.webDir,
    options.webCommand,
    { API_URL: `http://127.0.0.1:${api.port}`, NEXT_TELEMETRY_DISABLED: '1' },
    await findFreePort()
  )
  const problems: string[] = []
  const deadline = Date.now() + options.timeoutMs
  const apiUp = await pollUntilHealthy(
    `http://127.0.0.1:${api.port}/health`,
    deadline,
    api.hasExited
  )
  const webUp = await pollUntilHealthy(
    `http://127.0.0.1:${web.port}/health`,
    deadline,
    web.hasExited
  )
  if (apiUp === undefined) problems.push('the API did not become healthy')
  if (webUp === undefined) problems.push('the web app did not answer GET /health')

  if (apiUp !== undefined && webUp !== undefined) {
    const html = await (await fetch(`http://127.0.0.1:${web.port}/`)).text()
    const line = statusLine(html) ?? ''
    const expected = [
      'API ✓ connected',
      ...(options.hasDatabase ? [options.databaseUp ? 'DB ✓ connected' : 'DB ✗ unreachable'] : [])
    ]
    for (const part of expected) {
      if (!line.includes(part)) problems.push(`status page says "${line}", expected "${part}"`)
    }
  }

  // `next start` ends with the conventional 143 (128 + SIGTERM) after a clean stop; the API is
  // DevStack's own code and must exit 0 (D-55, D-63)
  const cleanCodes = { web: [0, 143], api: [0] } as const
  for (const [name, app] of [
    ['web', web],
    ['api', api]
  ] as const) {
    const stopped = await stopGroup(app.pid, app.exited)
    if (
      stopped.kind !== 'exit' ||
      !(cleanCodes[name] as readonly number[]).includes(stopped.code)
    ) {
      problems.push(`${name} did not shut down cleanly on SIGTERM: ${describeExit(stopped)}`)
    }
  }
  const output = `--- api ---\n${api.output()}\n--- web ---\n${web.output()}`
  return { ok: problems.length === 0, problems, output }
}
