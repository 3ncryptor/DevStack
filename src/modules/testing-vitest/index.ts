import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'testing-vitest',
  title: 'Vitest',
  category: 'testing',
  language: 'node',
  description: 'Vitest for the API tests (health, envelope, rate limiting), with Supertest',
  requiresAny: ['http-framework'],
  devDependencies: ['vitest'],
  // Nest brings its own config with the SWC plugin
  files: [{ path: 'vitest.config.ts', when: { not: { framework: 'framework-nest' } } }],
  scripts: [{ name: 'test', run: 'vitest run', depth: 'wired' }],
  filesPath: moduleFilesPath('testing-vitest')
}

export default moduleDefinition
