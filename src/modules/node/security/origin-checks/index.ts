import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'http:fastify' }
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'security-origin-checks',
  title: 'Origin allowlist checks',
  category: 'security',
  language: 'node',
  wizard: {
    question: 'appSetup',
    order: 6,
    label: 'Origin allowlist (ALLOWED_ORIGINS)',
    checked: false
  },
  description: 'Strict origin allowlist checks for Express or NestJS requests',
  requiresAny: ['http:connect', 'http:fastify'],
  // the middleware imports express types, which Nest does not bring in on its own
  devDependencies: [{ name: '@types/express', when: CONNECT }],
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
      when: CONNECT
    },
    {
      slot: 'app.middleware',
      code: 'app.use(originCheckMiddleware)',
      order: 50,
      when: CONNECT
    },
    {
      slot: 'app.imports',
      code: "import { registerOriginCheck } from './plugins/origin-check.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'registerOriginCheck(app)', order: 50, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/origin-check.ts', when: CONNECT },
    { path: 'src/plugins/origin-check.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/security/origin-checks')
}

export default moduleDefinition
