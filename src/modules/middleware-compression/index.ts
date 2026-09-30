import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-compression',
  description: 'Response compression middleware',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['compression'],
  slots: [
    {
      slot: 'app.imports',
      code: "import { compressionMiddleware } from './middlewares/compression.js'"
    },
    { slot: 'app.middleware', code: 'app.use(compressionMiddleware)', order: 70 }
  ],
  filesPath: moduleFilesPath('middleware-compression')
}

export default moduleDefinition
