import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'rate-limit',
  description: 'API rate limiting middleware for Express or NestJS',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: {
    'express-rate-limit': '^7.5.0'
  },
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
