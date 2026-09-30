import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'middleware-cors',
  description: 'CORS middleware for Express or NestJS APIs',
  requiresAny: ['framework-express', 'framework-nest'],
  dependencies: ['cors'],
  env: [
    {
      name: 'ALLOWED_ORIGINS',
      description: 'Comma-separated origins allowed to call the API, e.g. https://app.example.com',
      required: false,
      warnIfUnset:
        'ALLOWED_ORIGINS is empty, so CORS accepts requests from any origin. Set it before deploying.'
    }
  ],
  slots: [
    { slot: 'app.imports', code: "import { corsMiddleware } from './middlewares/cors.js'" },
    { slot: 'app.middleware', code: 'app.use(corsMiddleware)', order: 40 }
  ],
  filesPath: moduleFilesPath('middleware-cors')
}

export default moduleDefinition
