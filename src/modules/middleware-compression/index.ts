import path from 'node:path'

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
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
