import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'quality-husky',
  description: 'Husky + lint-staged + commitlint setup',
  requiresAny: ['linter-eslint', 'formatter-prettier'],
  devDependencies: ['@commitlint/cli', '@commitlint/config-conventional', 'husky', 'lint-staged'],
  packageJson: {
    scripts: {
      prepare: 'husky',
      'lint-staged': 'lint-staged'
    }
  }
}

export default moduleDefinition
