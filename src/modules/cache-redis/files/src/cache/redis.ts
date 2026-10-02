import { createClient } from 'redis'

const MAX_RECONNECT_DELAY_MS = 2_000

/** One client per process. While Redis is away it reconnects on its own, backing off. */
export const redis = createClient({
  url: process.env.REDIS_URL,
  // commands fail at once while disconnected instead of queueing until Redis is back
  disableOfflineQueue: true,
  socket: {
    reconnectStrategy: (retries: number) => Math.min(retries * 100, MAX_RECONNECT_DELAY_MS)
  }
})

let connecting: Promise<unknown> | undefined
let lastError: Error | undefined

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error))

// Without a listener an 'error' event would crash the process. Reconnects fail many times a
// second while Redis is down, so the latest error is kept for the readiness check instead of logged.
redis.on('error', (error: unknown) => {
  lastError = toError(error)
})
redis.on('ready', () => {
  lastError = undefined
})

/**
 * Connects on first use. The promise settles once Redis first answers (it waits through
 * reconnects), or when the client is closed.
 */
export function connectRedis(): Promise<unknown> {
  connecting ??= redis.connect().catch((error: unknown) => {
    lastError = toError(error)
  })
  return connecting
}

/** Readiness check: connected, and Redis answers a PING. */
export async function checkRedis(): Promise<void> {
  const connected = connectRedis()
  if (!redis.isReady && lastError !== undefined) throw lastError
  await connected
  await redis.ping()
}

/** Shutdown: close the connection, ending reconnect attempts too. */
export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) await redis.close()
}
