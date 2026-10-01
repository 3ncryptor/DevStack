import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { ResolutionError } from '../src/errors'
import type { GenerationPlan } from '../src/types/plan'

const API = [
  'layout-monorepo',
  'framework-express',
  'orm-prisma',
  'quality-eslint',
  'quality-prettier',
  'quality-husky'
]

function plan(modules: string[], packageManager: 'npm' | 'pnpm' = 'pnpm'): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'mono-app',
    projectDir: '/virtual/mono-app',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager,
    packageManagerVersion: '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)
const json = (result: GenerationPlan, file: string): Record<string, unknown> =>
  JSON.parse(result.files.find((candidate) => candidate.path === file)?.content ?? '{}') as Record<
    string,
    unknown
  >

describe('monorepo layout (tasks 2.1–2.3, B8)', () => {
  it('puts backend modules under apps/api and tooling at the root', async () => {
    const files = paths(await plan(API))

    for (const expected of [
      'package.json',
      'turbo.json',
      'pnpm-workspace.yaml',
      '.gitignore',
      'eslint.config.mjs',
      '.prettierrc',
      '.husky/pre-commit',
      '.devstack/stack.json',
      'README.md',
      'apps/api/package.json',
      'apps/api/tsconfig.json',
      'apps/api/src/index.ts',
      'apps/api/src/app.ts',
      'apps/api/prisma/schema.prisma',
      'apps/api/.env',
      'apps/api/tests/health.test.ts'
    ]) {
      expect(files).toContain(expected)
    }
    expect(files).not.toContain('src/app.ts')
    expect(files).not.toContain('.env')
  })

  it('gives each target its own manifest: tooling at the root, the app in apps/api', async () => {
    const result = await plan(API)
    const root = json(result, 'package.json') as {
      name: string
      packageManager: string
      workspaces: string[]
      scripts: Record<string, string>
      devDependencies: Record<string, string>
      dependencies: Record<string, string>
    }
    const api = json(result, 'apps/api/package.json') as {
      name: string
      scripts: Record<string, string>
      dependencies: Record<string, string>
    }

    expect(root.name).toBe('mono-app')
    expect(root.packageManager).toBe('pnpm@12.6.0')
    expect(root.workspaces).toEqual(['apps/*', 'packages/*'])
    expect(root.scripts.dev).toBe('turbo run dev')
    expect(root.scripts.lint).toBe('eslint .')
    expect(Object.keys(root.devDependencies)).toEqual(
      expect.arrayContaining(['turbo', 'eslint', 'prettier', 'husky'])
    )
    expect(root.dependencies).toEqual({})
    expect(api.name).toBe('@mono-app/api')
    expect(api.dependencies.express).toBeDefined()
    expect(api.scripts['db:migrate']).toBe('prisma migrate dev')
    expect(api.scripts.lint).toBeUndefined()
  })

  it('lists the workspace packages for pnpm next to the build approvals', async () => {
    const yaml = (await plan(API)).files.find(
      (file) => file.path === 'pnpm-workspace.yaml'
    )?.content

    expect(yaml).toContain("packages:\n  - 'apps/*'\n  - 'packages/*'")
    expect(yaml).toContain('allowBuilds:')
  })

  it('serves the API on 3001, leaving 3000 for the web app (D-30)', async () => {
    const dotEnv = (await plan(API)).files.find((file) => file.path === 'apps/api/.env')?.content

    expect(dotEnv).toContain('PORT=3001')
  })

  it('runs module commands inside their target', async () => {
    const commands = (await plan(API)).commands.map((command) => [
      command.phase,
      command.cwd ?? '.',
      command.args.join(' ')
    ])

    expect(commands).toContainEqual(['install', '.', 'install'])
    expect(commands).toContainEqual(['postInstall', 'apps/api', 'exec prisma generate'])
  })

  it('lint-staged matches files in every workspace', async () => {
    const config = json(await plan(API), '.lintstagedrc.json')

    expect(config['*.{ts,tsx}']).toEqual(['eslint --fix'])
  })

  it('refuses Docker until the per-app images of task 3.7', async () => {
    await expect(plan([...API, 'devops-docker'])).rejects.toThrow(ResolutionError)
  })
})
