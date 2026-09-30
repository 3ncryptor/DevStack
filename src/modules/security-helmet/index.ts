import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'security-helmet',
  description: 'Security headers via Helmet middleware for Express or NestJS',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['helmet'],
  slots: [
    { slot: 'app.imports', code: "import { helmetMiddleware } from './middlewares/helmet'" },
    { slot: 'app.middleware', code: 'app.use(helmetMiddleware)', order: 30 }
  ],
  filesPath: moduleFilesPath('security-helmet')
}

export default moduleDefinition
