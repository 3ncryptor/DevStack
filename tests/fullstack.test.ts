import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { ResolutionError } from '../src/errors'
import type { GenerationPlan } from '../src/types/plan'

const FULLSTACK = [
  'layout-monorepo',
  'framework-express',
  'orm-prisma',
  'middleware-cors',
  'framework-nextjs',
  'ui-tailwind',
  'quality-eslint',
  'quality-prettier'
]

function plan(modules: string[], packageManager: 'npm' | 'pnpm' = 'pnpm'): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'full-app',
    projectDir: '/virtual/full-app',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager,
    packageManagerVersion: '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)
const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''

describe('fullstack wiring (task 3.9, B17.4)', () => {
  it('writes the web app, the shared package and the API side by side', async () => {
    const files = paths(await plan(FULLSTACK))

    for (const expected of [
      'apps/api/src/app.ts',
      'apps/web/package.json',
      'apps/web/tsconfig.json',
      'apps/web/next.config.ts',
      'apps/web/postcss.config.mjs',
      'apps/web/app/layout.tsx',
      'apps/web/app/page.tsx',
      'apps/web/app/globals.css',
      'apps/web/app/health/route.ts',
      'apps/web/lib/env.ts',
      'apps/web/lib/status.ts',
      'apps/web/lib/api.ts',
      'apps/web/.env',
      'packages/shared/package.json',
      'packages/shared/tsconfig.json',
      'packages/shared/src/index.ts',
      'packages/shared/src/envelope.ts',
      'packages/shared/src/api-client.ts'
    ]) {
      expect(files).toContain(expected)
    }
  })

  it('links the web app to the shared package through the workspace', async () => {
    const web = (result: GenerationPlan) =>
      JSON.parse(content(result, 'apps/web/package.json')) as {
        dependencies: Record<string, string>
        scripts: Record<string, string>
      }

    expect(web(await plan(FULLSTACK)).dependencies['@full-app/shared']).toBe('workspace:*')
    expect(web(await plan(FULLSTACK, 'npm')).dependencies['@full-app/shared']).toBe('*')
    expect(web(await plan(FULLSTACK)).scripts.typecheck).toBe('next typegen && tsc --noEmit')
  })

  it('proxies /api to the API in development and transpiles the shared source', async () => {
    const config = content(await plan(FULLSTACK), 'apps/web/next.config.ts')

    expect(config).toContain("transpilePackages: ['@full-app/shared']")
    expect(config).toContain("source: '/api/:path*'")
  })

  it('points each app at the other on the D-30 ports, and CORS at the web origin (D-29)', async () => {
    const result = await plan(FULLSTACK)

    expect(content(result, 'apps/web/.env')).toContain('API_URL=http://localhost:3001')
    expect(content(result, 'apps/api/.env')).toContain('PORT=3001')
    expect(content(result, 'apps/api/.env')).toContain('ALLOWED_ORIGINS=http://localhost:3000')
  })

  it('does not warn about an empty CORS allowlist it filled in itself', async () => {
    const result = await plan(FULLSTACK)
    const cors = result.env.find((variable) => variable.name === 'ALLOWED_ORIGINS')

    expect(cors?.warnings).toEqual([])
  })

  it('renders the status page from /ready on the server', async () => {
    const page = content(await plan(FULLSTACK), 'apps/web/app/page.tsx')

    expect(page).toContain("export const dynamic = 'force-dynamic'")
    expect(page).toContain('getStatus()')
  })

  it('styles with plain CSS when Tailwind is not selected', async () => {
    const result = await plan(FULLSTACK.filter((id) => id !== 'ui-tailwind'))

    expect(paths(result)).not.toContain('apps/web/postcss.config.mjs')
    expect(content(result, 'apps/web/app/globals.css')).not.toContain('tailwindcss')
  })

  it('needs the monorepo layout for now', async () => {
    await expect(plan(['framework-express', 'framework-nextjs'])).rejects.toThrow(ResolutionError)
  })
})
