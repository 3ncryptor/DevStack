import { app } from './app'

const port = Number(process.env.PORT ?? 3000)
const SHUTDOWN_TIMEOUT_MS = 10_000

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

/** Stop accepting connections, let in-flight requests finish, then exit (buildPlan B17.2). */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`)
  const timeout = setTimeout(() => {
    console.error(`Shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS} ms, exiting`)
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  timeout.unref()

  server.close((error) => {
    if (error) {
      console.error('Error while closing the server', error)
      process.exit(1)
    }
    process.exit(0)
  })
  server.closeIdleConnections()
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
