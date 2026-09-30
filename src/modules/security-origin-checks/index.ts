import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'security-origin-checks',
  description: 'Strict origin allowlist checks for Express or NestJS requests',
  requiresAny: ['framework-express', 'framework-nest'],
  filesPath: moduleFilesPath('security-origin-checks')
}

export default moduleDefinition
