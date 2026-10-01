import { spawn } from 'node:child_process'

import { execa } from 'execa'

/** How much output a failure message carries: the end, where the error is. */
const OUTPUT_TAIL_CHARS = 6000

export interface RunOptions {
  cwd: string
  env?: Readonly<Record<string, string>>
  timeoutMs?: number
}

export interface CommandResult {
  ok: boolean
  exitCode: number
  /** stdout and stderr interleaved, trimmed to the tail. */
  output: string
  stdout: string
}

/** Runs a command without a shell; never throws for a failing command. Injected in tests. */
export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: RunOptions
) => Promise<CommandResult>

export const runCommand: CommandRunner = async (command, args, options) => {
  const result = await execa(command, args, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeoutMs,
    reject: false,
    all: true,
    stdin: 'ignore'
  })
  const ok = result.exitCode === 0 && !result.timedOut
  return {
    ok,
    exitCode: result.exitCode ?? 1,
    output: (result.all ?? result.message).slice(-OUTPUT_TAIL_CHARS),
    stdout: result.stdout
  }
}

export interface ExitStatus {
  code: number | null
  signal: NodeJS.Signals | null
}

export interface RunningProcess {
  exited: Promise<ExitStatus>
  hasExited: () => boolean
  /** Signals the whole process group, so a wrapper and its child both get it. */
  signal: (signal: NodeJS.Signals) => void
  output: () => string
}

/** Starts a long-running process (an app being verified) in its own process group. */
export function startProcess(
  command: string,
  args: readonly string[],
  options: Omit<RunOptions, 'timeoutMs'>
): RunningProcess {
  const groups = process.platform !== 'win32'
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    detached: groups,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  let status: ExitStatus | undefined
  const append = (chunk: Buffer): void => {
    output = (output + chunk.toString()).slice(-OUTPUT_TAIL_CHARS)
  }
  child.stdout.on('data', append)
  child.stderr.on('data', append)
  const exited = new Promise<ExitStatus>((resolve) => {
    child.once('error', (error) => {
      output += `\nfailed to start ${command}: ${error.message}`
      status = { code: 127, signal: null }
      resolve(status)
    })
    child.once('exit', (code, signal) => {
      status = { code, signal }
      resolve(status)
    })
  })
  return {
    exited,
    hasExited: () => status !== undefined,
    signal: (signal) => {
      if (child.pid === undefined || status !== undefined) return
      try {
        process.kill(groups ? -child.pid : child.pid, signal)
      } catch {
        // already gone between the check and the kill: nothing left to stop
      }
    },
    output: () => output
  }
}
