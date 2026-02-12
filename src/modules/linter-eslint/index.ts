import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'linter-eslint',
  description: 'ESLint setup for TypeScript projects',
  requires: ['language-node'],
  devDependencies: {
    '@typescript-eslint/eslint-plugin': '^8.16.0',
    '@typescript-eslint/parser': '^8.16.0',
    eslint: '^8.57.1',
    'eslint-config-prettier': '^9.1.0'
  },
  filesPath: path.join(__dirname, 'files'),
  packageJson: {
    scripts: {
      lint: 'eslint . --ext .ts',
      'lint:fix': 'eslint . --ext .ts --fix'
    }
  }
}

export default moduleDefinition
