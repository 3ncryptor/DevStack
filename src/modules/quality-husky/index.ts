import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'quality-husky',
  title: 'Husky + lint-staged + commitlint',
  category: 'quality',
  language: 'node',
  depth: 'bare',
  // repo-wide tooling: at the root of a monorepo
  target: 'root',
  provides: ['git-hooks'],
  description: 'Husky + lint-staged + commitlint setup',
  requiresAny: ['linter', 'formatter'],
  // secretlint: staged files are scanned for keys and tokens before a commit (Q-13)
  devDependencies: [
    '@commitlint/cli',
    '@commitlint/config-conventional',
    '@secretlint/secretlint-rule-preset-recommend',
    'husky',
    'lint-staged',
    'secretlint'
  ],
  packageJson: {
    scripts: {
      prepare: 'husky',
      'lint-staged': 'lint-staged'
    }
  }
}

export default moduleDefinition
