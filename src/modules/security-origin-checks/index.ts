import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'security-origin-checks',
  title: 'Origin allowlist checks',
  category: 'security',
  language: 'node',
  description: 'Strict origin allowlist checks for Express or NestJS requests',
  requiresAny: ['framework-express', 'framework-nest'],
  // the middleware imports express types, which Nest does not bring in on its own
  devDependencies: ['@types/express'],
  env: [
    {
      name: 'ALLOWED_ORIGINS',
      description: 'Comma-separated origins allowed to call the API, e.g. https://app.example.com',
      required: false,
      warnIfUnset:
        'ALLOWED_ORIGINS is empty, so origin checks let requests from any origin through.'
    }
  ],
  slots: [
    {
      slot: 'app.imports',
      code: "import { originCheckMiddleware } from './middlewares/origin-check.js'"
    },
    { slot: 'app.middleware', code: 'app.use(originCheckMiddleware)', order: 50 }
  ],
  filesPath: moduleFilesPath('security-origin-checks')
}

export default moduleDefinition
