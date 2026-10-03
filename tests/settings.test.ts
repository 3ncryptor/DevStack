import * as prettier from 'prettier'
import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { resolveSettings, settingsSchema, type ProjectSettings } from '../src/core/settings'
import type { GenerationPlan } from '../src/types/plan'

const registry = loadModules()

const BACKEND = ['framework-express', 'database-postgres', 'orm-prisma', 'devops-docker']
const FULLSTACK = [
  'layout-monorepo',
  'framework-express',
  'framework-nextjs',
  'database-postgres',
  'orm-prisma',
  'devops-docker',
  'devops-docker-web',
  'devops-github-actions'
]

function plan(modules: string[], settings?: ProjectSettings): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'settings-app',
    projectDir: '/virtual/settings-app',
    selectedModuleNames: modules,
    registry,
    packageManager: 'pnpm',
    packageManagerVersion: '10.26.2',
    options: { skipInstall: false, skipGit: false },
    secret: () => 'fixed-secret-0123456789abcdefghijklmnopqrstuvw',
    now: () => new Date('2026-10-03T12:00:00Z'),
    settings
  })
}

const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''
const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)

describe('resolving settings (tasks 5.1-5.3)', () => {
  it('fills in the defaults and lets later sources win field by field', () => {
    const settings = resolveSettings(
      { style: { semi: true }, license: 'MIT' },
      { style: { printWidth: 80 }, author: 'Ada' }
    )

    expect(settings.style).toEqual({
      semi: true,
      singleQuote: true,
      trailingComma: 'none',
      printWidth: 80,
      tabWidth: 2,
      useTabs: false
    })
    expect(settings.license).toBe('MIT')
    expect(settings.author).toBe('Ada')
    expect(settings.apps).toEqual({ backend: 'api', frontend: 'web', admin: 'admin' })
  })

  it('refuses app folders that collide, are not kebab-case or shadow the shared package', () => {
    expect(() => resolveSettings({ apps: { backend: 'web' } })).toThrow(/App folder names/)
    expect(settingsSchema.safeParse({ apps: { backend: 'My App' } }).success).toBe(false)
    expect(settingsSchema.safeParse({ apps: { frontend: 'shared' } }).success).toBe(false)
    expect(settingsSchema.safeParse({ ports: { backend: 80 } }).success).toBe(false)
  })

  it('refuses two apps on one port once the layout defaults are filled in', async () => {
    await expect(plan(FULLSTACK, { ports: { backend: 3000 } })).rejects.toThrow(/Ports must differ/)
  })
})

describe('code style (task 5.1, exit gate)', () => {
  it('changes only the formatting of the generated files', async () => {
    const plain = await plan([...BACKEND, 'quality-prettier'])
    const styled = await plan([...BACKEND, 'quality-prettier'], {
      style: { semi: true, singleQuote: false, tabWidth: 4, trailingComma: 'all', printWidth: 80 }
    })
    const config = JSON.parse(content(plain, '.prettierrc')) as prettier.Options
    const normalised = (file: { path: string; content: string }): Promise<string> =>
      prettier.getFileInfo(file.path).then(({ inferredParser }) =>
        inferredParser === null
          ? file.content
          : // Prettier keeps an object it once expanded expanded; collapse compares the code alone
            prettier.format(file.content, {
              ...config,
              objectWrap: 'collapse',
              filepath: file.path
            })
      )
    const differing = styled.files.filter(
      (file) => !['.prettierrc', '.editorconfig', '.devstack/stack.json'].includes(file.path)
    )

    expect(paths(styled)).toEqual(paths(plain))
    expect(content(styled, 'src/app.ts')).toContain(';')
    for (const file of differing) {
      expect(await normalised(file), file.path).toBe(
        await normalised({ path: file.path, content: content(plain, file.path) })
      )
    }
  })

  it('writes the style into .prettierrc and the indentation into .editorconfig', async () => {
    const result = await plan([...BACKEND, 'quality-prettier'], {
      style: { useTabs: true, tabWidth: 4 }
    })

    expect(JSON.parse(content(result, '.prettierrc'))).toMatchObject({ useTabs: true, tabWidth: 4 })
    expect(content(result, '.editorconfig')).toContain('indent_style = tab\nindent_size = 4')
  })
})

describe('TS strictness (task 5.2)', () => {
  it('adds the strictest checks to every strict tsconfig', async () => {
    const result = await plan(FULLSTACK, { strictness: 'strictest' })
    const tsconfigs = paths(result).filter((file) => file.endsWith('tsconfig.json'))

    expect(tsconfigs.length).toBeGreaterThan(1)
    for (const file of tsconfigs) {
      const { compilerOptions } = JSON.parse(content(result, file)) as {
        compilerOptions: Record<string, unknown>
      }
      expect(compilerOptions, file).toMatchObject({
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitOverride: true
      })
    }
  })

  it('leaves the standard tier as the modules wrote it', async () => {
    const result = await plan(BACKEND)

    expect(content(result, 'tsconfig.json')).not.toContain('noUncheckedIndexedAccess')
  })
})

describe('naming and metadata (task 5.3)', () => {
  it('names the apps and their ports everywhere: folders, compose, Dockerfiles, env, CI', async () => {
    const result = await plan(FULLSTACK, {
      apps: { backend: 'server', frontend: 'site' },
      ports: { backend: 4100, frontend: 4000 }
    })
    const compose = content(result, 'docker-compose.yml')

    expect(paths(result)).toEqual(
      expect.arrayContaining([
        'apps/server/package.json',
        'apps/server/Dockerfile',
        'apps/site/package.json',
        'apps/site/Dockerfile'
      ])
    )
    expect(paths(result).some((file) => file.startsWith('apps/api/'))).toBe(false)
    expect(compose).toContain('  server:\n')
    expect(compose).toContain("- '${API_PORT:-4100}:4100'")
    expect(compose).toContain('API_URL: http://server:4100')
    expect(content(result, 'apps/server/Dockerfile')).toContain('EXPOSE 4100')
    expect(content(result, 'apps/server/.env.example')).toMatch(/PORT=4100/)
    expect(content(result, 'apps/site/.env.example')).toContain('API_URL=http://localhost:4100')
    expect(content(result, 'apps/site/next.config.ts')).toContain("'http://localhost:4100'")
    expect(content(result, '.github/workflows/ci.yml')).not.toContain('apps/api')
  })

  it('serves a single app on the chosen port', async () => {
    const result = await plan(BACKEND, { ports: { backend: 4100 } })

    expect(content(result, '.env.example')).toMatch(/PORT=4100/)
    expect(content(result, 'Dockerfile')).toContain('EXPOSE 4100')
  })

  it('writes the license, the author and the description', async () => {
    const result = await plan(BACKEND, {
      license: 'MIT',
      author: 'Ada Lovelace',
      description: 'An engine'
    })
    const manifest = JSON.parse(content(result, 'package.json')) as Record<string, unknown>

    expect(content(result, 'LICENSE')).toContain('Copyright (c) 2026 Ada Lovelace')
    expect(manifest).toMatchObject({
      license: 'MIT',
      author: 'Ada Lovelace',
      description: 'An engine'
    })
  })

  it('writes no LICENSE for a private project', async () => {
    const result = await plan(BACKEND)

    expect(paths(result)).not.toContain('LICENSE')
    expect(JSON.parse(content(result, 'package.json'))).toMatchObject({ license: 'UNLICENSED' })
  })

  it('records every resolved setting in the manifest, ports included', async () => {
    const result = await plan(FULLSTACK, { apps: { backend: 'server' } })
    const manifest = JSON.parse(content(result, '.devstack/stack.json')) as {
      settings: ProjectSettings
    }

    expect(manifest.settings.apps).toEqual({ backend: 'server', frontend: 'web', admin: 'admin' })
    expect(manifest.settings.ports).toEqual({ backend: 3001, frontend: 3000, admin: 3002 })
    expect(manifest.settings.initialCommit).toBe(true)
  })
})
