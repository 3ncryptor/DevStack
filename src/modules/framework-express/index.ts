import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'framework-express',
  title: 'Express',
  category: 'framework',
  language: 'node',
  provides: ['http-framework'],
  description: 'Express HTTP server setup',
  requires: ['language-node', 'core-backend'],
  dependencies: ['express'],
  exposesSlots: ['app.imports', 'app.middleware', 'app.routes'],
  env: [
    {
      name: 'PORT',
      description: 'Port the HTTP server listens on',
      example: '3000',
      required: false,
      schema: 'z.coerce.number().int().min(1).max(65535).default(3000)'
    }
  ],
  filesPath: moduleFilesPath('framework-express'),
  // dev, build and start come from language-node: the entry point is src/index.ts
  scripts: [{ name: 'test', run: 'node --import tsx --test "tests/**/*.test.ts"', depth: 'wired' }]
}

export default moduleDefinition
