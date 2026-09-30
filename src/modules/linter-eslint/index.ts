import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'linter-eslint',
  description: 'ESLint setup for TypeScript projects',
  requires: ['language-node'],
  devDependencies: [
    '@eslint/js',
    'eslint',
    'eslint-config-prettier',
    'globals',
    'typescript-eslint'
  ],
  filesPath: moduleFilesPath('linter-eslint'),
  packageJson: {
    scripts: {
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix'
    }
  }
}

export default moduleDefinition
