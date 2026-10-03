import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

/**
 * Fastify 5 with the backend baseline (B17.2, M4): the same env, logger, error envelope, request
 * id, health/ready and graceful shutdown as Express, as Fastify plugins and hooks. Middleware
 * modules contribute Fastify plugins to `app.plugins`; the Express `app.middleware` slot is not
 * offered, so Express code never lands in a Fastify app.
 */
const moduleDefinition: DevstackModule = {
  id: 'framework-fastify',
  title: 'Fastify',
  category: 'framework',
  language: 'node',
  provides: ['http-framework'],
  description: 'Fastify 5 HTTP server with the backend baseline',
  requires: ['language-node', 'core-backend'],
  dependencies: ['fastify'],
  exposesSlots: [
    'app.imports',
    'app.plugins',
    'app.routes',
    'app.deps',
    'index.imports',
    'index.deps',
    'test.imports',
    'test.deps'
  ],
  env: [
    {
      name: 'PORT',
      description: 'Port the HTTP server listens on',
      example: '3000',
      required: false,
      schema: 'z.coerce.number().int().min(1).max(65535).default(3000)'
    }
  ],
  filesPath: moduleFilesPath('node/framework/fastify'),
  scripts: [
    {
      name: 'test',
      run: 'node --import tsx --test "tests/**/*.test.ts"',
      depth: 'wired',
      when: { not: { any: [{ has: 'testing-vitest' }, { has: 'testing-jest' }] } }
    }
  ]
}

export default moduleDefinition
