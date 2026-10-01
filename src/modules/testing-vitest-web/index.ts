import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'testing-vitest-web',
  title: 'Vitest (web apps)',
  category: 'testing',
  language: 'node',
  // every web app, the admin app included
  target: 'frontend',
  description: 'Vitest for the web apps, starting with the status page logic',
  requires: ['framework-nextjs'],
  devDependencies: ['vitest'],
  scripts: [{ name: 'test', run: 'vitest run', depth: 'wired' }],
  filesPath: moduleFilesPath('testing-vitest-web')
}

export default moduleDefinition
