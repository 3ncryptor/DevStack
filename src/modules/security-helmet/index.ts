import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'security-helmet',
  description: 'Security headers via Helmet middleware for Express or NestJS',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['helmet'],
  filesPath: moduleFilesPath('security-helmet')
}

export default moduleDefinition
