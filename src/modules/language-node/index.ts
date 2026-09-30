import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'language-node',
  description: 'Node.js + TypeScript runtime foundation',
  devDependencies: ['@types/node', 'tsx', 'typescript'],
  filesPath: moduleFilesPath('language-node'),
  packageJson: {
    scripts: {
      build: 'tsc -p tsconfig.json',
      dev: 'tsx watch src/index.ts',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit'
    },
    engines: {
      node: '>=24'
    }
  }
}

export default moduleDefinition
