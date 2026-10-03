import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'http:fastify' }
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'security-helmet',
  title: 'Helmet security headers',
  category: 'security',
  language: 'node',
  wizard: { question: 'appSetup', order: 2, checked: true },
  description: 'Security headers via Helmet middleware for Express or NestJS',
  requiresAny: ['http:connect', 'http:fastify'],
  dependencies: [
    { name: 'helmet', when: CONNECT },
    { name: '@fastify/helmet', when: FASTIFY }
  ],
  slots: [
    {
      slot: 'app.imports',
      code: "import { helmetMiddleware } from './middlewares/helmet.js'",
      when: CONNECT
    },
    { slot: 'app.middleware', code: 'app.use(helmetMiddleware)', order: 30, when: CONNECT },
    {
      slot: 'app.imports',
      code: "import { registerHelmet } from './plugins/helmet.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'await registerHelmet(app)', order: 30, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/helmet.ts', when: CONNECT },
    { path: 'src/plugins/helmet.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/security/helmet')
}

export default moduleDefinition
