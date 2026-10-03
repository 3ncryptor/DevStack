import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'testing-vitest-web',
  title: 'Vitest (web apps)',
  category: 'testing',
  language: 'node',
  // every web app, the admin app included
  target: 'frontend',
  description: 'Vitest for the web apps, starting with the status page logic',
  requiresAny: ['web:next', 'web:vite'],
  // vite is vitest's peer: declared, because yarn classic does not install peers
  devDependencies: ['vitest', 'vite'],
  // the session logic of auth-jwt's web client (refresh on 401, one refresh at a time)
  files: [{ path: 'tests/auth.test.ts', when: { has: 'auth-jwt' } }],
  scripts: [{ name: 'test', run: 'vitest run', depth: 'wired' }],
  filesPath: moduleFilesPath('node/testing/vitest-web')
}

export default moduleDefinition
