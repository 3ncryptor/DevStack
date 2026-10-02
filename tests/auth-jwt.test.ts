import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan, type PlanInput } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import type { GenerationPlan } from '../src/types/plan'

const FULLSTACK = [...(getPreset('fullstack-next-express')?.modules ?? []), 'auth-jwt']
const BACKEND = [...(getPreset('backend')?.modules ?? []), 'auth-jwt']
const FIXED_SECRET = 'fixed-test-secret-0123456789abcdefghijklmnop'

function plan(
  modules: readonly string[],
  overrides: Partial<PlanInput> = {}
): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'auth-app',
    projectDir: '/virtual/auth-app',
    selectedModuleNames: [...modules],
    registry: loadModules(),
    packageManager: 'pnpm',
    options: { skipInstall: false, skipGit: false },
    secret: () => FIXED_SECRET,
    ...overrides
  })
}

const contentOf = (generated: GenerationPlan, filePath: string): string =>
  generated.files.find((file) => file.path === filePath)?.content ?? ''

describe('auth-jwt (B17.5, D-66)', () => {
  it('puts the auth domain in src/features with feature-scoped architecture', async () => {
    const generated = await plan(FULLSTACK)

    expect(contentOf(generated, 'apps/api/src/features/auth/auth.service.ts')).toContain(
      'export function createAuthService'
    )
    expect(contentOf(generated, 'apps/api/src/app.ts')).toContain(
      "from './features/auth/auth.routes.js'"
    )
  })

  it('puts it in src/modules with any other architecture', async () => {
    const generated = await plan(BACKEND)

    expect(generated.modules).toContain('arch-clean')
    expect(contentOf(generated, 'src/modules/auth/auth.service.ts')).not.toBe('')
    expect(contentOf(generated, 'src/index.ts')).toContain("from './modules/auth/auth.service.js'")
  })

  it('leaves no path token unresolved in any path or file', async () => {
    const generated = await plan(FULLSTACK)

    const offenders = generated.files.filter(
      (file) => file.path.includes('__domains__') || file.content.includes('__domains__')
    )
    expect(offenders.map((file) => file.path)).toEqual([])
  })

  it('wires the service in the composition root and the test helper', async () => {
    const generated = await plan(FULLSTACK)

    expect(contentOf(generated, 'apps/api/src/index.ts')).toContain(
      'auth: createAuthService({ ...prismaAuthRepositories, config: authConfig(env) })'
    )
    expect(contentOf(generated, 'apps/api/tests/helpers/app.ts')).toContain(
      'auth: testAuthService()'
    )
    expect(contentOf(generated, 'apps/api/src/app.ts')).toContain('auth: AuthService')
  })

  it('adds the User and RefreshToken models to the Prisma schema', async () => {
    const schema = contentOf(await plan(FULLSTACK), 'apps/api/prisma/schema.prisma')

    expect(schema).toContain('model User {')
    expect(schema).toContain('model RefreshToken {')
    expect(schema).toContain('enum Role {')
  })

  it('generates JWT_SECRET into .env only, never into .env.example', async () => {
    const generated = await plan(FULLSTACK)

    expect(contentOf(generated, 'apps/api/.env')).toContain(`JWT_SECRET=${FIXED_SECRET}`)
    expect(contentOf(generated, 'apps/api/.env.example')).toMatch(/^JWT_SECRET=$/m)
  })

  it('draws a fresh random secret when none is injected', async () => {
    const first = await plan(FULLSTACK, { secret: undefined })
    const second = await plan(FULLSTACK, { secret: undefined })

    const secretOf = (generated: GenerationPlan) =>
      /^JWT_SECRET=(.+)$/m.exec(contentOf(generated, 'apps/api/.env'))?.[1] ?? ''
    expect(secretOf(first)).toMatch(/^[\w-]{43}$/)
    expect(secretOf(first)).not.toBe(secretOf(second))
  })

  it('limits login and register harder when rate limiting is selected', async () => {
    const routes = contentOf(await plan(FULLSTACK), 'apps/api/src/features/auth/auth.routes.ts')

    expect(routes).toContain('credentialLimit')
  })

  it('matches the recorded plan for the fullstack preset with auth', async () => {
    const generated = await plan(FULLSTACK)

    expect(
      generated.files
        .filter((file) => /auth|schema\.prisma|app\.ts|index\.ts$|\.env/.test(file.path))
        .map((file) => ({
          path: file.path,
          sha256: createHash('sha256').update(file.content).digest('hex').slice(0, 16)
        }))
    ).toMatchSnapshot()
  })
})

describe('auth-session (D-78)', () => {
  const SESSION = [...BACKEND, 'auth-session']

  it('brings auth-jwt and Redis, and swaps the access tokens for Redis sessions', async () => {
    const generated = await plan(SESSION)
    const index = contentOf(generated, 'src/index.ts')

    expect(generated.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'src/cache/redis.ts',
        'src/cache/session-store.redis.ts',
        'src/modules/auth/session-tokens.ts',
        'tests/auth.session.test.ts'
      ])
    )
    expect(index).toContain('accessTokens: createSessionTokens(redisSessionStore')
    expect(index.match(/auth: createAuthService/g)).toHaveLength(1)
  })

  it('runs the generated auth tests on in-memory sessions', async () => {
    const helper = contentOf(await plan(SESSION), 'tests/helpers/auth.ts')

    expect(helper).toContain('export function memorySessionStore(): SessionStore')
    expect(helper).toContain('accessTokens: createSessionTokens(memorySessionStore()')
  })

  it('keeps stateless JWTs without it', async () => {
    const generated = await plan(BACKEND)

    expect(contentOf(generated, 'src/index.ts')).not.toContain('createSessionTokens')
    expect(contentOf(generated, 'tests/helpers/auth.ts')).not.toContain('memorySessionStore')
  })
})
