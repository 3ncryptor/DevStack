import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'rate-limit',
  description: 'API rate limiting middleware for Express or NestJS',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['express-rate-limit'],
  filesPath: moduleFilesPath('rate-limit')
}

export default moduleDefinition
