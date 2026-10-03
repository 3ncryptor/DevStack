import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'framework-fastify' }
const NOT_FASTIFY: Condition = { not: FASTIFY }

const moduleDefinition: DevstackModule = {
  id: 'security-origin-checks',
  title: 'Origin allowlist checks',
  category: 'security',
  language: 'node',
  description: 'Strict origin allowlist checks for Express or NestJS requests',
  requiresAny: ['http-framework'],
  // the middleware imports express types, which Nest does not bring in on its own
  devDependencies: [{ name: '@types/express', when: NOT_FASTIFY }],
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
      code: "import { originCheckMiddleware } from './middlewares/origin-check.js'",
      when: NOT_FASTIFY
    },
    {
      slot: 'app.middleware',
      code: 'app.use(originCheckMiddleware)',
      order: 50,
      when: NOT_FASTIFY
    },
    {
      slot: 'app.imports',
      code: "import { registerOriginCheck } from './plugins/origin-check.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'registerOriginCheck(app)', order: 50, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/origin-check.ts', when: NOT_FASTIFY },
    { path: 'src/plugins/origin-check.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/security/origin-checks')
}

export default moduleDefinition
