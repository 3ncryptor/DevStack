import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'language-node',
  description: 'Node.js + TypeScript runtime foundation',
  devDependencies: {
    '@types/node': '^22.10.2',
    tsx: '^4.19.2',
    typescript: '^5.7.2'
  },
  filesPath: moduleFilesPath('language-node'),
  packageJson: {
    scripts: {
      build: 'tsc -p tsconfig.json',
      dev: 'tsx watch src/index.ts',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit'
    },
    engines: {
      node: '>=18.18.0'
    }
  }
}

export default moduleDefinition
