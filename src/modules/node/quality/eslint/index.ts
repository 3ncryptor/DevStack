import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'quality-eslint',
  title: 'ESLint',
  category: 'quality',
  language: 'node',
  depth: 'bare',
  // repo-wide tooling: at the root of a monorepo
  target: 'root',
  provides: ['linter'],
  description: 'ESLint setup for TypeScript projects',
  requires: ['language-node'],
  devDependencies: [
    '@eslint/js',
    'eslint',
    'eslint-config-prettier',
    'globals',
    'typescript-eslint'
  ],
  filesPath: moduleFilesPath('node/quality/eslint'),
  packageJson: {
    scripts: {
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix'
    }
  }
}

export default moduleDefinition
