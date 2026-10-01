import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import type { GenerationPlan } from '../src/types/plan'

const FULLSTACK = [...(getPreset('fullstack-next-express')?.modules ?? []), 'app-admin']
const BACKEND = [...(getPreset('backend')?.modules ?? [])]
const FIXED_SECRET = 'fixed-test-secret-0123456789abcdefghijklmnop'

function plan(
  modules: readonly string[],
  providers: { github?: boolean; google?: boolean } = {}
): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'ba-app',
    projectDir: '/virtual/ba-app',
    selectedModuleNames: [...modules, 'auth-better-auth'],
    moduleOptions: { 'auth-better-auth': providers },
    registry: loadModules(),
    packageManager: 'pnpm',
    options: { skipInstall: false, skipGit: false },
    secret: () => FIXED_SECRET
  })
}

const contentOf = (generated: GenerationPlan, filePath: string): string =>
  generated.files.find((file) => file.path === filePath)?.content ?? ''

describe('auth-better-auth (task 4.2, D-38, D-69)', () => {
  it('mounts Better Auth under /v1/auth before the JSON body parser', async () => {
    const app = contentOf(await plan(FULLSTACK), 'apps/api/src/app.ts')

    const mount = app.indexOf("app.all('/v1/auth/*splat', toNodeHandler(deps.auth))")
    expect(mount).toBeGreaterThan(-1)
    expect(mount).toBeLessThan(app.indexOf('app.use(express.json())'))
    expect(contentOf(await plan(FULLSTACK), 'apps/api/src/features/auth/auth.ts')).toContain(
      "AUTH_BASE_PATH = '/v1/auth'"
    )
  })

  it('mounts at /auth without API versioning', async () => {
    const app = contentOf(await plan(BACKEND), 'src/app.ts')

    expect(app).toContain("app.all('/auth/*splat', toNodeHandler(deps.auth))")
  })

  it('declares and configures only the selected OAuth providers', async () => {
    const withGitHub = await plan(FULLSTACK, { github: true })
    const without = await plan(FULLSTACK)

    expect(contentOf(withGitHub, 'apps/api/.env.example')).toMatch(/^GITHUB_CLIENT_ID=$/m)
    expect(contentOf(withGitHub, 'apps/api/.env.example')).not.toContain('GOOGLE_CLIENT_ID')
    expect(contentOf(withGitHub, 'apps/api/src/features/auth/auth.ts')).toContain('github')
    expect(contentOf(without, 'apps/api/.env.example')).not.toContain('GITHUB_CLIENT_ID')
    expect(contentOf(without, 'apps/api/src/features/auth/auth.ts')).not.toContain('github')
  })

  it('shows a login button per selected provider in the web app, none in the admin app', async () => {
    const generated = await plan(FULLSTACK, { github: true, google: true })

    const login = contentOf(generated, 'apps/web/app/login/page.tsx')
    expect(login).toContain('Continue with GitHub')
    expect(login).toContain('Continue with Google')
    // admins never sign up, so the admin app logs in with a password only (D-67)
    expect(contentOf(generated, 'apps/admin/app/login/page.tsx')).not.toContain('Continue with')
    expect(contentOf(await plan(FULLSTACK), 'apps/web/app/login/page.tsx')).not.toContain(
      'Continue with'
    )
  })

  it("uses Better Auth's routes from the web client and the API's /me", async () => {
    const session = contentOf(await plan(FULLSTACK), 'apps/web/lib/auth/session.ts')

    expect(session).toContain("authRequest('/sign-in/email'")
    expect(session).toContain("api.get<{ user: SessionUser }>('/me')")
    expect(session).not.toContain('/auth/refresh')
  })

  it('gives the web app a register page and the admin app none (D-67)', async () => {
    const generated = await plan(FULLSTACK)

    expect(contentOf(generated, 'apps/web/app/register/page.tsx')).not.toBe('')
    expect(contentOf(generated, 'apps/admin/app/register/page.tsx')).toBe('')
    expect(contentOf(generated, 'apps/admin/app/page.tsx')).toContain('<RequireAuth role="ADMIN">')
  })

  it('generates BETTER_AUTH_SECRET into .env only and adds its Prisma models', async () => {
    const generated = await plan(FULLSTACK)

    expect(contentOf(generated, 'apps/api/.env')).toContain(`BETTER_AUTH_SECRET=${FIXED_SECRET}`)
    expect(contentOf(generated, 'apps/api/.env.example')).toMatch(/^BETTER_AUTH_SECRET=$/m)
    const schema = contentOf(generated, 'apps/api/prisma/schema.prisma')
    for (const model of ['User', 'Session', 'Account', 'Verification']) {
      expect(schema).toContain(`model ${model} {`)
    }
  })

  it('leaves no path token unresolved', async () => {
    const generated = await plan(FULLSTACK, { github: true })

    expect(
      generated.files
        .filter((file) => file.path.includes('__domains__') || file.content.includes('__domains__'))
        .map((file) => file.path)
    ).toEqual([])
  })

  it('cannot be combined with auth-jwt (one auth module per API)', async () => {
    await expect(plan([...FULLSTACK, 'auth-jwt'])).rejects.toThrow(/auth/)
  })
})
