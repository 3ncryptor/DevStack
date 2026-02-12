import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-morgan',
  description: 'HTTP request logging using Morgan',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: {
    morgan: '^1.10.0'
  },
  devDependencies: {
    '@types/morgan': '^1.9.9'
  },
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
