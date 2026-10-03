import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'testing-vitest',
  title: 'Vitest',
  category: 'testing',
  language: 'node',
  wizard: { question: 'tests', order: 1 },
  vscodeExtensions: ['vitest.explorer'],
  description: 'Vitest for the API tests (health, envelope, rate limiting), with Supertest',
  requiresAny: ['http-framework'],
  // vite is vitest's peer: declared, because yarn classic does not install peers
  devDependencies: ['vitest', 'vite'],
  // Nest brings its own config with the SWC plugin
  files: [{ path: 'vitest.config.ts', when: { not: { framework: 'framework-nest' } } }],
  scripts: [{ name: 'test', run: 'vitest run', depth: 'wired' }],
  filesPath: moduleFilesPath('node/testing/vitest')
}

export default moduleDefinition
