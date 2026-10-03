import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'http:fastify' }
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'middleware-compression',
  title: 'Response compression',
  category: 'middleware',
  language: 'node',
  wizard: { question: 'appSetup', order: 5, checked: false },
  description: 'Response compression middleware',
  requiresAny: ['http:connect', 'http:fastify'],
  dependencies: [
    { name: 'compression', when: CONNECT },
    { name: '@fastify/compress', when: FASTIFY }
  ],
  slots: [
    {
      slot: 'app.imports',
      code: "import { compressionMiddleware } from './middlewares/compression.js'",
      when: CONNECT
    },
    {
      slot: 'app.middleware',
      code: 'app.use(compressionMiddleware)',
      order: 70,
      when: CONNECT
    },
    {
      slot: 'app.imports',
      code: "import { registerCompression } from './plugins/compression.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'await registerCompression(app)', order: 70, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/compression.ts', when: CONNECT },
    { path: 'src/plugins/compression.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/middleware/compression')
}

export default moduleDefinition
