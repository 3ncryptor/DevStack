import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-morgan',
  description: 'HTTP request logging using Morgan',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['morgan'],
  filesPath: moduleFilesPath('middleware-morgan')
}

export default moduleDefinition
