import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'quality-eslint',
  title: 'ESLint',
  category: 'quality',
  language: 'node',
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
  filesPath: moduleFilesPath('quality-eslint'),
  packageJson: {
    scripts: {
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix'
    }
  }
}

export default moduleDefinition
