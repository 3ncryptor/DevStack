import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'framework-fastify' }
const NOT_FASTIFY: Condition = { not: FASTIFY }

const moduleDefinition: DevstackModule = {
  id: 'security-helmet',
  title: 'Helmet security headers',
  category: 'security',
  language: 'node',
  description: 'Security headers via Helmet middleware for Express or NestJS',
  requiresAny: ['http-framework'],
  dependencies: [
    { name: 'helmet', when: NOT_FASTIFY },
    { name: '@fastify/helmet', when: FASTIFY }
  ],
  slots: [
    {
      slot: 'app.imports',
      code: "import { helmetMiddleware } from './middlewares/helmet.js'",
      when: NOT_FASTIFY
    },
    { slot: 'app.middleware', code: 'app.use(helmetMiddleware)', order: 30, when: NOT_FASTIFY },
    {
      slot: 'app.imports',
      code: "import { registerHelmet } from './plugins/helmet.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'await registerHelmet(app)', order: 30, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/helmet.ts', when: NOT_FASTIFY },
    { path: 'src/plugins/helmet.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/security/helmet')
}

export default moduleDefinition
