import type { Logger } from './logger.js'

/** A dependency the app needs before it can serve traffic, e.g. the database. */
export interface ReadinessCheck {
  name: string
  check: () => Promise<void>
}

export type CheckStatus = 'ok' | 'error'

/** What GET /ready returns: no error details, which could leak internals. */
export interface ReadinessReport {
  status: CheckStatus
  checks: Record<string, CheckStatus>
}

export interface ReadinessResult {
  report: ReadinessReport
  failures: Array<{ name: string; error: unknown }>
}

const CHECK_TIMEOUT_MS = 2_000

/**
 * One run per check at a time: while a dependency hangs, more /ready calls wait on the same run
 * instead of piling up queries that could exhaust its connection pool.
 */
const inFlight = new WeakMap<ReadinessCheck, Promise<void>>()

function shared(check: ReadinessCheck): Promise<void> {
  const running = inFlight.get(check)
  if (running !== undefined) return running
  const run = check.check().finally(() => inFlight.delete(check))
  inFlight.set(check, run)
  return run
}

async function withTimeout(check: ReadinessCheck): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${CHECK_TIMEOUT_MS} ms`))
    }, CHECK_TIMEOUT_MS)
  })
  try {
    await Promise.race([shared(check), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Runs every check in parallel; one failing check makes the app not ready. */
export async function runReadiness(checks: readonly ReadinessCheck[]): Promise<ReadinessResult> {
  const results = await Promise.allSettled(checks.map((check) => withTimeout(check)))
  const failures = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [{ name: checks[index]?.name ?? '?', error: result.reason as unknown }]
      : []
  )
  const checkStatus = Object.fromEntries(
    checks.map((check) => [
      check.name,
      failures.some((failure) => failure.name === check.name) ? 'error' : 'ok'
    ])
  ) as Record<string, CheckStatus>
  return {
    report: { status: failures.length === 0 ? 'ok' : 'error', checks: checkStatus },
    failures
  }
}

/** Logs at startup which dependencies are not reachable yet; the app keeps serving /health. */
export async function reportReadiness(
  checks: readonly ReadinessCheck[],
  logger: Logger
): Promise<void> {
  const { failures } = await runReadiness(checks)
  for (const failure of failures) {
    logger.warn(
      { check: failure.name, err: failure.error },
      `${failure.name} is not ready; GET /ready answers 503 until it is`
    )
  }
}
