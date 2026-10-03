import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'framework-express',
  title: 'Express',
  category: 'framework',
  language: 'node',
  wizard: { question: 'framework', order: 1 },
  provides: ['http-framework', 'http:connect', 'http:express'],
  description: 'Express HTTP server setup',
  requires: ['language-node', 'core-backend'],
  dependencies: ['express'],
  exposesSlots: [
    'app.imports',
    'app.middleware',
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
  filesPath: moduleFilesPath('node/framework/express'),
  // dev, build and start come from language-node: the entry point is src/index.ts
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
