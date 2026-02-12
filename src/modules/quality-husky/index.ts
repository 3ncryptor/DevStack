import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'quality-husky',
  description: 'Husky + lint-staged + commitlint setup',
  requiresAny: ['linter-eslint', 'formatter-prettier'],
  devDependencies: {
    '@commitlint/cli': '^19.6.1',
    '@commitlint/config-conventional': '^19.6.0',
    husky: '^9.1.7',
    'lint-staged': '^15.2.10'
  },
  packageJson: {
    scripts: {
      prepare: 'husky',
      'lint-staged': 'lint-staged'
    }
  }
}

export default moduleDefinition
