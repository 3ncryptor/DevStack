import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { collectEnv } from '../src/core/planner/env'
import { getPreset } from '../src/core/presets'
import type { Depth } from '../src/types/module'
import type { GenerationPlan } from '../src/types/plan'
import { testModule } from './helpers/modules'

const BACKEND = [...(getPreset('backend')?.modules ?? [])]
const NEST = ['framework-nest', 'security-helmet', 'orm-prisma']

function plan(modules: string[], depth: Depth = 'wired'): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'golden-app',
    projectDir: '/virtual/golden-app',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager: 'pnpm',
    depth,
    options: { skipInstall: false, skipGit: false }
  })
}

const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)
const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''
const scripts = (result: GenerationPlan): Record<string, string> =>
  (JSON.parse(content(result, 'package.json')) as { scripts: Record<string, string> }).scripts

describe('env declarations → config/env.ts (B17.2, B17.7)', () => {
  it('defaults the schema from `required` and keeps an explicit one', () => {
    const env = collectEnv([
      testModule({
        id: 'a',
        env: [
          { name: 'REQUIRED_ONE', description: 'r', required: true },
          { name: 'OPTIONAL_ONE', description: 'o', required: false },
          {
            name: 'PORT',
            description: 'p',
            required: false,
            schema: 'z.coerce.number().default(3000)'
          }
        ]
      })
    ])

    expect(env.map((variable) => [variable.name, variable.schema])).toEqual([
      ['REQUIRED_ONE', 'z.string().min(1)'],
      ['OPTIONAL_ONE', 'z.string().optional()'],
      ['PORT', 'z.coerce.number().default(3000)']
    ])
  })

  it('validates every declared variable at startup', async () => {
    const source = content(await plan(BACKEND), 'src/config/env.ts')

    for (const name of ['NODE_ENV', 'LOG_LEVEL', 'PORT', 'DATABASE_URL', 'ALLOWED_ORIGINS']) {
      expect(source).toContain(`${name}:`)
    }
    expect(source).toContain('export function loadEnv')
  })

  it('writes a local .env from the examples, never replacing an existing one', async () => {
    const result = await plan(BACKEND)
    const dotEnv = result.files.find((file) => file.path === '.env')

    expect(dotEnv?.strategy).toBe('skip-if-exists')
    expect(dotEnv?.content).toContain('DATABASE_URL="postgresql://postgres:postgres@localhost')
    expect(dotEnv?.content).toContain('PORT=3000')
    // no example means unset, not empty
    expect(dotEnv?.content).toContain('# ALLOWED_ORIGINS=')
  })
})

describe('Express golden path (B17.2)', () => {
  it('writes the entry, app factory, baseline libraries, health routes and a test', async () => {
    const files = paths(await plan(BACKEND))

    for (const expected of [
      'src/index.ts',
      'src/app.ts',
      'src/config/env.ts',
      'src/lib/logger.ts',
      'src/lib/errors.ts',
      'src/lib/readiness.ts',
      'src/lib/shutdown.ts',
      'src/lifecycle.ts',
      'src/middlewares/request-id.ts',
      'src/middlewares/error-handler.ts',
      'src/middlewares/not-found.ts',
      'src/middlewares/validate.ts',
      'src/routes/health.ts',
      'tests/health.test.ts',
      'tsconfig.build.json',
      'README.md'
    ]) {
      expect(files).toContain(expected)
    }
    expect(files).not.toContain('src/server.ts')
  })

  it('mounts middleware in the B17.2 order around the routes', async () => {
    const app = content(await plan(BACKEND), 'src/app.ts')
    const order = [
      'requestId(',
      'requestLoggerMiddleware',
      'helmetMiddleware',
      'corsMiddleware',
      'originCheckMiddleware',
      'apiRateLimiter',
      'express.json(',
      'createHealthRouter(',
      'notFound',
      'errorHandler('
    ].map((marker) => app.lastIndexOf(marker))

    expect(order.every((index) => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('runs its tests with node:test and builds only src', async () => {
    const result = await plan(BACKEND)

    expect(scripts(result).test).toBe('node --import tsx --test "tests/**/*.test.ts"')
    expect(scripts(result).build).toBe('tsc -p tsconfig.build.json')
    expect(scripts(result).start).toBe('node dist/index.js')
  })
})

describe('Nest golden path (B17.2)', () => {
  it('writes an app factory, exception filter, health module and a test', async () => {
    const files = paths(await plan(NEST))

    for (const expected of [
      'src/main.ts',
      'src/app.ts',
      'src/app.module.ts',
      'src/filters/error.filter.ts',
      'src/health/health.controller.ts',
      'src/lib/nest-logger.ts',
      'src/pipes/zod-validation.pipe.ts',
      'src/config/env.ts',
      'tests/health.test.ts'
    ]) {
      expect(files).toContain(expected)
    }
    expect(files).not.toContain('src/app.controller.ts')
  })

  it('runs its tests through the SWC loader that keeps decorator metadata', async () => {
    expect(scripts(await plan(NEST)).test).toBe(
      'node --import @swc-node/register/esm-register --test "tests/**/*.test.ts"'
    )
  })
})

describe('Prisma wiring (B17.3)', () => {
  it('registers a readiness check and a disposer through the lifecycle slots', async () => {
    const result = await plan(BACKEND)
    const lifecycle = content(result, 'src/lifecycle.ts')

    expect(paths(result)).toContain('src/db/client.ts')
    expect(lifecycle).toContain("name: 'db', check: checkDatabase")
    expect(lifecycle).toContain("name: 'db', dispose: disconnectDatabase")
  })

  it('leaves the lifecycle empty without a database', async () => {
    const lifecycle = content(await plan(['framework-express']), 'src/lifecycle.ts')

    expect(lifecycle).not.toContain('checkDatabase')
  })

  it('still plans Prisma without a framework, where nothing exposes the lifecycle slots', async () => {
    const files = paths(await plan(['language-node', 'orm-prisma']))

    expect(files).toContain('src/db/client.ts')
    expect(files).not.toContain('src/lifecycle.ts')
  })

  it('adds db scripts, and db:up/db:down only when compose has the database', async () => {
    const withoutDocker = scripts(await plan(BACKEND))
    const withDocker = scripts(await plan([...BACKEND, 'devops-docker']))

    expect(withoutDocker['db:migrate']).toBe('prisma migrate dev')
    expect(withoutDocker['db:up']).toBeUndefined()
    expect(withDocker['db:up']).toBe('docker compose up -d db')
    expect(withDocker['db:down']).toBe('docker compose down')
  })

  it('starts the image with the new entry point', async () => {
    const dockerfile = content(await plan([...BACKEND, 'devops-docker']), 'Dockerfile')

    expect(dockerfile).toContain('CMD ["node", "dist/index.js"]')
  })
})

describe('bare depth', () => {
  it('writes none of the baseline code', async () => {
    const files = paths(await plan(BACKEND, 'bare'))

    for (const absent of [
      'src/app.ts',
      'src/config/env.ts',
      'src/lib/logger.ts',
      'tests/health.test.ts'
    ]) {
      expect(files).not.toContain(absent)
    }
    expect(files).toContain('src/index.ts')
  })
})

describe('generated README', () => {
  it('lists the stack, scripts and env vars', async () => {
    const readme = content(await plan(BACKEND), 'README.md')

    expect(readme).toContain('# golden-app')
    expect(readme).toContain('Express')
    expect(readme).toContain('Prisma + PostgreSQL')
    expect(readme).toContain('pnpm run dev')
    expect(readme).toContain('`DATABASE_URL`')
  })
})
