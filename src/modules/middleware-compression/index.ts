import { moduleFilesPath } from '../../paths'
import type { Condition, DevstackModule } from '../../types/module'

const FASTIFY: Condition = { has: 'framework-fastify' }
const NOT_FASTIFY: Condition = { not: FASTIFY }

const moduleDefinition: DevstackModule = {
  id: 'middleware-compression',
  title: 'Response compression',
  category: 'middleware',
  language: 'node',
  description: 'Response compression middleware',
  requiresAny: ['http-framework'],
  dependencies: [
    { name: 'compression', when: NOT_FASTIFY },
    { name: '@fastify/compress', when: FASTIFY }
  ],
  slots: [
    {
      slot: 'app.imports',
      code: "import { compressionMiddleware } from './middlewares/compression.js'",
      when: NOT_FASTIFY
    },
    {
      slot: 'app.middleware',
      code: 'app.use(compressionMiddleware)',
      order: 70,
      when: NOT_FASTIFY
    },
    {
      slot: 'app.imports',
      code: "import { registerCompression } from './plugins/compression.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'await registerCompression(app)', order: 70, when: FASTIFY }
  ],
  files: [
    { path: 'src/middlewares/compression.ts', when: NOT_FASTIFY },
    { path: 'src/plugins/compression.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('middleware-compression')
}

export default moduleDefinition
