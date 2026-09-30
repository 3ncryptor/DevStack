import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'rate-limit',
  description: 'API rate limiting middleware for Express or NestJS',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['express-rate-limit'],
  // its types reference express types, which Nest does not bring in on its own
  devDependencies: ['@types/express'],
  slots: [
    { slot: 'app.imports', code: "import { apiRateLimiter } from './middlewares/rate-limit.js'" },
    { slot: 'app.middleware', code: 'app.use(apiRateLimiter)', order: 60 }
  ],
  filesPath: moduleFilesPath('rate-limit')
}

export default moduleDefinition
