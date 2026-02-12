import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'security-origin-checks',
  description: 'Strict origin allowlist checks for Express or NestJS requests',
  requiresAny: ['framework-express', 'framework-nest'],
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
