import {
  packageManagerAdapter,
  type PackageManagerId as PackageManager
} from '../../adapters/package-manager/index'
import type { DevstackModule } from '../../types/module'
import type { PlannedFile } from '../../types/plan'
import { EXECUTABLE_MODE, generatedFile } from './files'

export function has(modules: readonly DevstackModule[], id: string): boolean {
  return modules.some((moduleDefinition) => moduleDefinition.id === id)
}

/** In a monorepo, patterns match in every workspace; the single layout keeps its src/ and tests/. */
function lintStagedConfig(
  modules: readonly DevstackModule[],
  monorepo: boolean
): Record<string, string[]> {
  // every staged file is scanned for credentials first (Q-13)
  const config: Record<string, string[]> = { '*': ['secretlint'] }
  if (has(modules, 'quality-prettier')) {
    config['*.{js,ts,tsx,jsx,json,md,yml,yaml}'] = ['prettier --write']
  }
  if (has(modules, 'quality-eslint')) {
    if (monorepo) {
      config['*.{ts,tsx}'] = ['eslint --fix']
    } else {
      config['src/**/*.ts'] = ['eslint --fix']
      config['tests/**/*.ts'] = ['eslint --fix']
    }
  }
  return config
}

export function huskyFiles(
  modules: readonly DevstackModule[],
  packageManager: PackageManager,
  monorepo: boolean
): PlannedFile[] {
  const pm = packageManagerAdapter(packageManager)
  const lintStaged = pm.hookCommand('lint-staged')
  const commitlint = `${pm.hookCommand('commitlint')} --edit "$1"`
  return [
    generatedFile(
      'commitlint.config.cjs',
      "module.exports = { extends: ['@commitlint/config-conventional'] }\n",
      { strategy: 'skip-if-exists' }
    ),
    generatedFile(
      '.secretlintrc.json',
      `${JSON.stringify({ rules: [{ id: '@secretlint/secretlint-rule-preset-recommend' }] }, null, 2)}\n`,
      { strategy: 'skip-if-exists' }
    ),
    generatedFile(
      '.lintstagedrc.json',
      `${JSON.stringify(lintStagedConfig(modules, monorepo))}\n`,
      { strategy: 'skip-if-exists' }
    ),
    generatedFile('.husky/pre-commit', `#!/usr/bin/env sh\n${lintStaged}\n`, {
      mode: EXECUTABLE_MODE
    }),
    generatedFile('.husky/commit-msg', `#!/usr/bin/env sh\n${commitlint}\n`, {
      mode: EXECUTABLE_MODE
    })
  ]
}
