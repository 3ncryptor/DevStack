import { spawn, type ChildProcess } from 'node:child_process'

export interface RunOptions {
  cwd: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
}

export interface RunResult {
  ok: boolean
  exitCode: number | null
  timedOut: boolean
  durationMs: number
  /** Tail of stdout + stderr, for failure reports. */
  output: string
  /** Complete stdout, for commands whose output is parsed (e.g. `npm pack --json`). */
  stdout: string
}

export type ExitStatus =
  { kind: 'exit'; code: number } | { kind: 'signal'; signal: NodeJS.Signals } | { kind: 'timeout' }

const OUTPUT_TAIL_CHARS = 4000
/** Grandchildren can hold the pipes open after the direct child exits; stop waiting after this. */
const PIPE_DRAIN_MS = 2000

const liveGroups = new Set<number>()

/** Spawns `command` as the leader of its own process group so the whole tree can be signalled. */
export function spawnGroup(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  })
  if (child.pid !== undefined) {
    const pid = child.pid
    liveGroups.add(pid)
    child.once('exit', () => liveGroups.delete(pid))
  }
  return child
}

export function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) {
    return
  }
  try {
    process.kill(-pid, signal)
  } catch {
    // group already gone
  }
}

/** Kills every process group this harness started; used when the harness itself is interrupted. */
export function killAllGroups(): void {
  for (const pid of liveGroups) {
    signalGroup(pid, 'SIGKILL')
  }
  liveGroups.clear()
}

export function describeExit(status: ExitStatus): string {
  switch (status.kind) {
    case 'exit':
      return `exit code ${status.code}`
    case 'signal':
      return `killed by ${status.signal} (no handler, or it re-raised the signal)`
    case 'timeout':
      return 'still running after the grace period; SIGKILL sent'
  }
}

/** Runs a command without a shell and captures the tail of its combined output. */
export function run(command: string, args: string[], options: RunOptions): Promise<RunResult> {
  const startedAt = Date.now()
  const child = spawnGroup(command, args, options.cwd, options.env)

  return new Promise((resolve) => {
    let output = ''
    let stdout = ''
    let timedOut = false
    let settled = false
    const append = (chunk: Buffer): void => {
      output = (output + chunk.toString()).slice(-OUTPUT_TAIL_CHARS)
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      append(chunk)
    })
    child.stderr?.on('data', append)

    const timer = setTimeout(() => {
      timedOut = true
      signalGroup(child.pid, 'SIGKILL')
    }, options.timeoutMs)

    const finish = (exitCode: number | null, extra = ''): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      child.stdout?.destroy()
      child.stderr?.destroy()
      const ok = exitCode === 0 && !timedOut
      resolve({
        ok,
        exitCode,
        timedOut,
        durationMs: Date.now() - startedAt,
        output: output + extra,
        stdout
      })
    }

    child.on('error', (error) => finish(null, `\n[spawn error] ${error.message}`))
    child.on('close', (code) => finish(code))
    child.on('exit', (code) => setTimeout(() => finish(code), PIPE_DRAIN_MS).unref())
  })
}
