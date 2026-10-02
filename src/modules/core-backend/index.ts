import { moduleFilesPath } from '../../paths'
import type { Condition, DevstackModule } from '../../types/module'

/** Express and Nest (platform-express) share the Express request pipeline. */
/** Winston or plain JSON logs: they bring their own lib/logger.ts. */
const OTHER_LOGGER: Condition = { any: [{ has: 'obs-winston' }, { has: 'obs-json-logs' }] }

const ON_EXPRESS: Condition = {
  any: [{ framework: 'framework-express' }, { framework: 'framework-nest' }]
}

const moduleDefinition: DevstackModule = {
  id: 'core-backend',
  title: 'Backend baseline',
  category: 'misc',
  language: 'node',
  // integration code only; required by every framework, never chosen on its own (B17.2)
  depth: 'wired',
  description:
    'Env validation, pino logger, error envelope, request id, readiness and graceful shutdown',
  requires: ['language-node'],
  files: [
    { path: 'src/lib/logger.ts', when: { not: OTHER_LOGGER } },
    { path: 'src/middlewares/request-id.ts', when: ON_EXPRESS },
    { path: 'src/types/express.d.ts', when: ON_EXPRESS }
  ],
  // pino is the default logger; the logger modules replace lib/logger.ts (D-76)
  dependencies: [{ name: 'pino', when: { not: OTHER_LOGGER } }, 'zod'],
  devDependencies: ['supertest', '@types/supertest'],
  exposesSlots: ['lifecycle.imports', 'app.readiness', 'app.shutdown'],
  env: [
    {
      name: 'NODE_ENV',
      description: 'development, test or production; production skips loading .env',
      example: 'development',
      required: false,
      schema: "z.enum(['development', 'test', 'production']).default('development')"
    },
    {
      name: 'LOG_LEVEL',
      description: 'pino log level: fatal, error, warn, info, debug, trace or silent',
      example: 'info',
      required: false,
      schema:
        "z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')"
    }
  ],
  filesPath: moduleFilesPath('core-backend')
}

export default moduleDefinition
