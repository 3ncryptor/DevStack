import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

/** Winston or plain JSON logs: they bring their own lib/logger.ts. */
const OTHER_LOGGER: Condition = { any: [{ has: 'obs-winston' }, { has: 'obs-json-logs' }] }
const PINO: Condition = { not: OTHER_LOGGER }
const NEST: Condition = { has: 'http:nest' }
/** Express and Nest (platform-express) share the Express request pipeline. */
const ON_EXPRESS: Condition = { has: 'http:connect' }

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
  devDependencies: ['supertest', '@types/supertest', { name: 'pino-pretty', when: PINO }],
  // pino's JSON lines made readable while developing; start, tests and production stay JSON
  scripts: [
    {
      name: 'dev',
      run: 'tsx watch src/index.ts | pino-pretty',
      when: { all: [PINO, { not: NEST }] }
    },
    {
      name: 'dev',
      run: 'node --watch --import @swc-node/register/esm-register src/main.ts | pino-pretty',
      when: { all: [PINO, NEST, { moduleSystem: 'esm' }] }
    },
    {
      name: 'dev',
      // ts-resolve.mjs comes with framework-nest under CommonJS (D-91)
      run: 'node --watch --import ./scripts/ts-resolve.mjs -r @swc-node/register src/main.ts | pino-pretty',
      when: { all: [PINO, NEST, { moduleSystem: 'cjs' }] }
    }
  ],
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
  filesPath: moduleFilesPath('node/core/backend')
}

export default moduleDefinition
