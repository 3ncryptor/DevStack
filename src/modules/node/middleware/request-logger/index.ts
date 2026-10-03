import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

// Fastify logs each request itself through pino (its app turns that on with this module)
const NOT_FASTIFY: Condition = { not: { has: 'framework-fastify' } }

const moduleDefinition: DevstackModule = {
  id: 'middleware-request-logger',
  title: 'HTTP request logger (morgan)',
  category: 'middleware',
  language: 'node',
  wizard: { question: 'appSetup', order: 4, label: 'Request logging', checked: true },
  description: 'HTTP request logging using Morgan',
  requiresAny: ['http-framework'],
  dependencies: [{ name: 'morgan', when: NOT_FASTIFY }],
  slots: [
    {
      slot: 'app.imports',
      code: "import { requestLoggerMiddleware } from './middlewares/request-logger.js'",
      when: NOT_FASTIFY
    },
    {
      slot: 'app.middleware',
      code: 'app.use(requestLoggerMiddleware)',
      order: 20,
      when: NOT_FASTIFY
    }
  ],
  files: [{ path: 'src/middlewares/request-logger.ts', when: NOT_FASTIFY }],
  filesPath: moduleFilesPath('node/middleware/request-logger')
}

export default moduleDefinition
