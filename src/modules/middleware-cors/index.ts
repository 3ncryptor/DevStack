import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-cors',
  description: 'CORS middleware for Express or NestJS APIs',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['cors'],
  filesPath: moduleFilesPath('middleware-cors')
}

export default moduleDefinition
