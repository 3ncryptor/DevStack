import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

// Fastify logs each request itself through pino (its app turns that on with this module)
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'middleware-request-logger',
  title: 'HTTP request logger (morgan)',
  category: 'middleware',
  language: 'node',
  wizard: { question: 'appSetup', order: 4, label: 'Request logging', checked: true },
  description: 'HTTP request logging using Morgan',
  requiresAny: ['http:connect', 'http:fastify'],
  dependencies: [{ name: 'morgan', when: CONNECT }],
  slots: [
    {
      slot: 'app.imports',
      code: "import { requestLoggerMiddleware } from './middlewares/request-logger.js'",
      when: CONNECT
    },
    {
      slot: 'app.middleware',
      code: 'app.use(requestLoggerMiddleware)',
      order: 20,
      when: CONNECT
    }
  ],
  files: [{ path: 'src/middlewares/request-logger.ts', when: CONNECT }],
  filesPath: moduleFilesPath('node/middleware/request-logger')
}

export default moduleDefinition
