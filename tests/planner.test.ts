import { createHash } from 'node:crypto'

import * as prettier from 'prettier'
import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan, type PlanInput } from '../src/core/planner/index'
import { toProjectRelativePath } from '../src/core/planner/files'
import { getPreset } from '../src/core/presets'
import type { GenerationPlan } from '../src/types/plan'

const BACKEND_MODULES = [...(getPreset('backend')?.modules ?? [])]

function planInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    projectName: 'snapshot-app',
    projectDir: '/virtual/snapshot-app',
    selectedModuleNames: BACKEND_MODULES,
    registry: loadModules(),
    packageManager: 'npm',
    options: { skipInstall: false, skipGit: false },
    ...overrides
  }
}

function fileAt(plan: GenerationPlan, filePath: string) {
  return plan.files.find((file) => file.path === filePath)
}

function summarise(plan: GenerationPlan) {
  return {
    modules: plan.modules,
    files: plan.files.map((file) => ({
      path: file.path,
      mode: file.mode.toString(8),
      strategy: file.strategy,
      sha256: createHash('sha256').update(file.content).digest('hex').slice(0, 16)
    })),
    commands: plan.commands.map((command) => [command.phase, command.command, ...command.args])
  }
}

describe('buildGenerationPlan', () => {
  it('is deterministic for the same input', async () => {
    const first = await buildGenerationPlan(planInput())
    const second = await buildGenerationPlan(planInput())

    expect(second).toEqual(first)
  })

  it('matches the recorded plan for the backend preset', async () => {
    const plan = await buildGenerationPlan(planInput())

    expect(summarise(plan)).toMatchSnapshot()
  })

  it('formats every file with the project Prettier config so `prettier --check` passes', async () => {
    const plan = await buildGenerationPlan(planInput())
    const config = JSON.parse(fileAt(plan, '.prettierrc')?.content ?? '{}') as prettier.Options

    const unformatted: string[] = []
    for (const file of plan.files) {
      const { inferredParser } = await prettier.getFileInfo(file.path)
      if (inferredParser === null) continue
      if (!(await prettier.check(file.content, { ...config, filepath: file.path }))) {
        unformatted.push(file.path)
      }
    }

    expect(unformatted).toEqual([])
  })

  it('writes git hooks as executable files', async () => {
    const plan = await buildGenerationPlan(planInput())

    expect(fileAt(plan, '.husky/pre-commit')?.mode).toBe(0o755)
    expect(fileAt(plan, '.husky/commit-msg')?.mode).toBe(0o755)
    expect(fileAt(plan, 'src/app.ts')?.mode).toBe(0o644)
  })

  it('restores dotfiles that npm strips from the published package', async () => {
    const plan = await buildGenerationPlan(planInput())

    expect(fileAt(plan, '.gitignore')).toBeDefined()
    expect(fileAt(plan, 'gitignore')).toBeUndefined()
  })

  it('adds the pnpm build approvals only for pnpm', async () => {
    const npmPlan = await buildGenerationPlan(planInput({ packageManager: 'npm' }))
    const pnpmPlan = await buildGenerationPlan(planInput({ packageManager: 'pnpm' }))

    expect(fileAt(npmPlan, 'pnpm-workspace.yaml')).toBeUndefined()
    expect(fileAt(pnpmPlan, 'pnpm-workspace.yaml')?.content).toContain("'prisma': true")
  })

  it('plans git, install, hooks and module commands as data', async () => {
    const plan = await buildGenerationPlan(planInput({ packageManager: 'pnpm' }))

    expect(
      plan.commands.map((command) => [command.phase, command.command, ...command.args])
    ).toEqual([
      ['git', 'git', 'init'],
      ['install', 'pnpm', 'install'],
      ['hooks', 'pnpm', 'exec', 'husky'],
      ['postInstall', 'pnpm', 'exec', 'prisma', 'generate']
    ])
  })

  it('drops install-dependent commands with --skip-install and git ones with --skip-git', async () => {
    const noInstall = await buildGenerationPlan(
      planInput({ options: { skipInstall: true, skipGit: false } })
    )
    const noGit = await buildGenerationPlan(
      planInput({ options: { skipInstall: false, skipGit: true } })
    )

    expect(noInstall.commands.map((command) => command.phase)).toEqual(['git'])
    expect(noGit.commands.map((command) => command.phase)).toEqual(['install', 'postInstall'])
  })
})

describe('framework slots (D-07)', () => {
  it('imports and mounts every selected middleware explicitly, in the documented order', async () => {
    const plan = await buildGenerationPlan(planInput())
    const app = fileAt(plan, 'src/app.ts')?.content ?? ''

    expect(app).not.toContain('require(')
    expect(app).not.toContain('.eta')
    const mounted = [...app.matchAll(/app\.use\((?:'[^']*',\s*)?(\w+)/g)].map((match) => match[1])
    expect(mounted).toEqual([
      'requestLoggerMiddleware',
      'helmetMiddleware',
      'corsMiddleware',
      'originCheckMiddleware',
      'apiRateLimiter',
      'compressionMiddleware',
      'express',
      'healthRouter'
    ])
    expect(app).toContain("import { helmetMiddleware } from './middlewares/helmet.js'")
  })

  it('only imports middleware that was selected', async () => {
    const modules = BACKEND_MODULES.filter((id) => id !== 'security-helmet')
    const plan = await buildGenerationPlan(planInput({ selectedModuleNames: modules }))

    expect(fileAt(plan, 'src/app.ts')?.content).not.toContain('helmet')
  })

  it('shuts the server down gracefully on SIGTERM and SIGINT', async () => {
    const plan = await buildGenerationPlan(planInput())
    const server = fileAt(plan, 'src/server.ts')?.content ?? ''

    expect(server).toContain("process.once('SIGTERM'")
    expect(server).toContain("process.once('SIGINT'")
  })

  it('mounts the same middleware in a Nest app', async () => {
    const plan = await buildGenerationPlan(
      planInput({ selectedModuleNames: ['framework-nest', 'security-helmet', 'middleware-cors'] })
    )
    const main = fileAt(plan, 'src/main.ts')?.content ?? ''

    expect(main).not.toContain('require(')
    expect(main).toContain('app.use(helmetMiddleware)')
    expect(main).toContain("process.once('SIGTERM'")
    expect(main).toContain('app.close()')
  })
})

describe('ESM output (D-53)', () => {
  it.each([
    ['backend preset', BACKEND_MODULES],
    ['nest', ['framework-nest', 'security-helmet', 'security-rate-limit', 'orm-prisma']]
  ])(
    'declares ESM and imports relative files with .js extensions (%s)',
    async (_label, modules) => {
      const plan = await buildGenerationPlan(planInput({ selectedModuleNames: modules }))
      const manifest = JSON.parse(fileAt(plan, 'package.json')?.content ?? '{}') as {
        type?: string
      }

      const extensionless = plan.files
        .filter((file) => file.path.endsWith('.ts'))
        .flatMap((file) =>
          [...file.content.matchAll(/from '(\.{1,2}\/[^']*)'/g)]
            .map((match) => match[1] ?? '')
            .filter((specifier) => !specifier.endsWith('.js'))
            .map((specifier) => `${file.path}: ${specifier}`)
        )

      expect(manifest.type).toBe('module')
      expect(extensionless).toEqual([])
    }
  )
})

describe('toProjectRelativePath', () => {
  it('restores the dot on templates npm would strip', () => {
    expect(toProjectRelativePath('gitignore')).toBe('.gitignore')
    expect(toProjectRelativePath('apps/api/gitignore')).toBe('apps/api/.gitignore')
  })

  it('leaves every other path unchanged and uses forward slashes', () => {
    expect(toProjectRelativePath('src/app.ts')).toBe('src/app.ts')
    expect(toProjectRelativePath('.prettierrc')).toBe('.prettierrc')
  })
})
