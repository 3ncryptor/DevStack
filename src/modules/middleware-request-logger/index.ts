import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'middleware-request-logger',
  title: 'HTTP request logger (morgan)',
  category: 'middleware',
  language: 'node',
  description: 'HTTP request logging using Morgan',
  requiresAny: ['http-framework'],
  dependencies: ['morgan'],
  slots: [
    {
      slot: 'app.imports',
      code: "import { requestLoggerMiddleware } from './middlewares/request-logger.js'"
    },
    { slot: 'app.middleware', code: 'app.use(requestLoggerMiddleware)', order: 20 }
  ],
  filesPath: moduleFilesPath('middleware-request-logger')
}

export default moduleDefinition
