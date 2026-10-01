import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'shared-api',
  title: 'Shared API types and client',
  category: 'misc',
  language: 'node',
  target: 'shared',
  depth: 'bare',
  description: 'packages/shared: the response envelope types and a typed fetch client (B17.4)',
  requires: ['layout:monorepo'],
  devDependencies: ['typescript'],
  filesPath: moduleFilesPath('shared-api'),
  packageJson: {
    type: 'module',
    // TypeScript source; the web app transpiles it
    exports: { '.': './src/index.ts' },
    scripts: {
      build: 'tsc --noEmit',
      typecheck: 'tsc --noEmit'
    }
  }
}

export default moduleDefinition
