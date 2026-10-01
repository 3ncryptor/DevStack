import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'middleware-compression',
  title: 'Response compression',
  category: 'middleware',
  language: 'node',
  description: 'Response compression middleware',
  requiresAny: ['http-framework'],
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
