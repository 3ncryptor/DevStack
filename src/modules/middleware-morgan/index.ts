import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-morgan',
  description: 'HTTP request logging using Morgan',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['morgan'],
  slots: [
    {
      slot: 'app.imports',
      code: "import { requestLoggerMiddleware } from './middlewares/request-logger'"
    },
    { slot: 'app.middleware', code: 'app.use(requestLoggerMiddleware)', order: 20 }
  ],
  filesPath: moduleFilesPath('middleware-morgan')
}

export default moduleDefinition
