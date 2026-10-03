import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import type { GenerationPlan } from '../src/types/plan'

function plan(modules: string[]): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'tested',
    projectDir: '/virtual/tested',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager: 'pnpm',
    packageManagerVersion: '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''
const scripts = (result: GenerationPlan, file = 'package.json'): Record<string, string> =>
  (JSON.parse(content(result, file)) as { scripts: Record<string, string> }).scripts

describe('testing-vitest (task 3.5)', () => {
  it('runs the API tests with Vitest instead of node:test', async () => {
    const result = await plan(['framework-express', 'testing-vitest'])

    expect(scripts(result).test).toBe('vitest run')
    expect(content(result, 'tests/health.test.ts')).toContain("import { test } from 'vitest'")
    expect(content(result, 'tests/health.test.ts')).not.toContain('void test(')
    expect(content(result, 'vitest.config.ts')).toContain('defineConfig')
  })

  it('keeps node:test without it', async () => {
    const result = await plan(['framework-express'])

    expect(content(result, 'tests/health.test.ts')).toContain("import { test } from 'node:test'")
    expect(content(result, 'tests/health.test.ts')).toContain('void test(')
  })

  it('compiles Nest tests with SWC so decorator metadata survives', async () => {
    const config = content(await plan(['framework-nest', 'testing-vitest']), 'vitest.config.ts')

    expect(config).toContain("import swc from 'unplugin-swc'")
  })

  it('tests the web apps with Vitest too', async () => {
    const result = await plan([
      'layout-monorepo',
      'framework-express',
      'framework-nextjs',
      'app-admin',
      'testing-vitest',
      'testing-vitest-web'
    ])

    for (const app of ['web', 'admin']) {
      expect(scripts(result, `apps/${app}/package.json`).test).toBe('vitest run')
      expect(content(result, `apps/${app}/tests/status.test.ts`)).toContain('getStatus')
    }
    expect(scripts(result, 'apps/api/package.json').test).toBe('vitest run')
  })
})

describe('secret scanning in the pre-commit hook (task 3.6, Q-13)', () => {
  it('runs secretlint on staged files with the recommended rules', async () => {
    const result = await plan([
      'framework-express',
      'quality-eslint',
      'quality-prettier',
      'quality-husky'
    ])
    const lintStaged = JSON.parse(content(result, '.lintstagedrc.json')) as Record<string, string[]>

    expect(lintStaged['*']).toEqual(['secretlint'])
    expect(content(result, '.secretlintrc.json')).toContain(
      '@secretlint/secretlint-rule-preset-recommend'
    )
  })
})
