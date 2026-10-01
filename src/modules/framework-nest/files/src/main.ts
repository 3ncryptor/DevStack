import 'reflect-metadata'

// config/env.js comes next: importing it loads .env before other modules read process.env
import { loadEnvOrExit } from './config/env.js'
import { createApp } from './app.js'
import { disposers, readinessChecks } from './lifecycle.js'
import { createLogger } from './lib/logger.js'
import { reportReadiness } from './lib/readiness.js'
import { handleShutdownSignals } from './lib/shutdown.js'

const env = loadEnvOrExit()
const logger = createLogger(env.LOG_LEVEL)
const app = await createApp({ logger, readinessChecks })

await app.listen(env.PORT)
logger.info(`listening on http://localhost:${env.PORT}`)
void reportReadiness(readinessChecks, logger)

// app.close() runs Nest's shutdown hooks; our handler exits 0 afterwards, where
// enableShutdownHooks() would re-raise the signal instead (D-55).
handleShutdownSignals({ logger, disposers, close: () => app.close() })
