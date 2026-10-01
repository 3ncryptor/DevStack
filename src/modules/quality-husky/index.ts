import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'quality-husky',
  title: 'Husky + lint-staged + commitlint',
  category: 'quality',
  language: 'node',
  provides: ['git-hooks'],
  description: 'Husky + lint-staged + commitlint setup',
  requiresAny: ['linter', 'formatter'],
  devDependencies: ['@commitlint/cli', '@commitlint/config-conventional', 'husky', 'lint-staged'],
  packageJson: {
    scripts: {
      prepare: 'husky',
      'lint-staged': 'lint-staged'
    }
  }
}

export default moduleDefinition
