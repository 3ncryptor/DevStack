import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-cors',
  description: 'CORS middleware for Express or NestJS APIs',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: {
    cors: '^2.8.5'
  },
  devDependencies: {
    '@types/cors': '^2.8.17'
  },
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
