import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-compression',
  description: 'Response compression middleware',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: {
    compression: '^1.7.5'
  },
  devDependencies: {
    '@types/compression': '^1.7.5'
  },
  filesPath: moduleFilesPath('middleware-compression')
}

export default moduleDefinition
