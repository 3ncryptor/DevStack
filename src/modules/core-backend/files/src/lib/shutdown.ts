import type { Logger } from './logger.js'

/** Releases a resource on shutdown, e.g. closes the database pool. */
export interface Disposer {
  name: string
  dispose: () => Promise<void>
}

export interface ShutdownOptions {
  logger: Logger
  /** Stops accepting connections and resolves once in-flight requests have finished. */
  close: () => Promise<void>
  disposers: readonly Disposer[]
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

/** Runs every disposer in order, even after one fails; resolves false if any failed. */
async function dispose(disposers: readonly Disposer[], logger: Logger): Promise<boolean> {
  let ok = true
  for (const disposer of disposers) {
    try {
      await disposer.dispose()
    } catch (error: unknown) {
      ok = false
      logger.error(
        { err: error, disposer: disposer.name },
        `${disposer.name} did not close cleanly`
      )
    }
  }
  return ok
}

/**
 * SIGTERM/SIGINT: stop accepting connections, drain, run disposers, exit 0. Exits 1 if any step
 * fails or the whole sequence takes longer than the timeout (B17.2, D-55).
 */
export function handleShutdownSignals(options: ShutdownOptions): void {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let shuttingDown = false

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      // a second Ctrl-C means "now"
      options.logger.warn({ signal }, 'second signal, exiting without waiting')
      process.exit(1)
    }
    shuttingDown = true
    options.logger.info({ signal }, 'shutting down')
    // not unref'd: a disposer that hangs with nothing else pending must still hit the timeout
    setTimeout(() => {
      options.logger.error({ timeoutMs }, 'shutdown did not finish in time')
      process.exit(1)
    }, timeoutMs)

    void options
      .close()
      .then(() => dispose(options.disposers, options.logger))
      .then(
        (ok) => process.exit(ok ? 0 : 1),
        (error: unknown) => {
          options.logger.error({ err: error }, 'error while closing the server')
          process.exit(1)
        }
      )
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
