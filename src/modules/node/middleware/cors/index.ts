import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'http:fastify' }
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'middleware-cors',
  title: 'CORS',
  category: 'middleware',
  language: 'node',
  wizard: { question: 'appSetup', order: 1, checked: true },
  description: 'CORS middleware for Express or NestJS APIs',
  requiresAny: ['http:connect', 'http:fastify'],
  dependencies: [
    { name: 'cors', when: CONNECT },
    { name: '@fastify/cors', when: FASTIFY }
  ],
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
    {
      slot: 'app.imports',
      code: "import { corsMiddleware } from './middlewares/cors.js'",
      when: CONNECT
    },
    { slot: 'app.middleware', code: 'app.use(corsMiddleware)', order: 40, when: CONNECT },
    {
      slot: 'app.imports',
      code: "import { registerCors } from './plugins/cors.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'await registerCors(app)', order: 40, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/cors.ts', when: CONNECT },
    { path: 'src/plugins/cors.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/middleware/cors')
}

export default moduleDefinition
