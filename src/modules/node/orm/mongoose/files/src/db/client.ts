import mongoose from 'mongoose'

/** How long one attempt looks for the server before failing (readiness reports it). */
const SERVER_SELECTION_TIMEOUT_MS = 5_000

/**
 * One connection per process. Register models on it, e.g. `connection.model('User', userSchema)`;
 * their queries wait (Mongoose buffers them) until the connection opens.
 */
export const connection = mongoose.createConnection()

/** Opens the connection when it is closed; after a failed attempt, the next call tries again. */
export async function connectDatabase(): Promise<void> {
  if (connection.readyState === mongoose.ConnectionStates.disconnected) {
    await connection.openUri(process.env.DATABASE_URL ?? '', {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS
    })
    return
  }
  await connection.asPromise()
}

/** Readiness check: connected, and the server answers a ping. */
export async function checkDatabase(): Promise<void> {
  await connectDatabase()
  if (connection.db === undefined) throw new Error('MongoDB connection is not open')
  await connection.db.admin().ping()
}

/** Shutdown: close the connection so the process does not wait on its sockets. */
export async function disconnectDatabase(): Promise<void> {
  await connection.close()
}
