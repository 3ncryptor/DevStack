import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'language-node',
  title: 'Node.js + TypeScript',
  category: 'language',
  language: 'node',
  depth: 'bare',
  files: [
    // placeholder entry point: only without a framework entry point, or when bare has no app code
    { path: 'src/index.ts', when: { any: [{ not: { has: 'http-framework' } }, { depth: 'bare' }] } }
  ],
  description: 'Node.js + TypeScript runtime foundation',
  devDependencies: ['@types/node', 'tsx', 'typescript'],
  filesPath: moduleFilesPath('node/language/node'),
  packageJson: {
    // generated projects are ESM (D-53); NodeNext resolution needs .js import extensions
    type: 'module',
    scripts: {
      // tsconfig.json also covers tests/ for typecheck and lint; the build compiles src/ only
      build: 'tsc -p tsconfig.build.json',
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
