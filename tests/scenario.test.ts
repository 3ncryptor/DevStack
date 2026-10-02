import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import type { GenerationPlan } from '../src/types/plan'

const registry = loadModules()

function plan(
  modules: string[],
  moduleOptions: Record<string, unknown> = {}
): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'shop',
    projectDir: '/virtual/shop',
    selectedModuleNames: modules,
    moduleOptions,
    registry,
    packageManager: 'pnpm',
    packageManagerVersion: '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)
const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''

describe('backend architectures (D-64)', () => {
  it('feature-scoped: features/ and shared/ with .gitkeep', async () => {
    const files = paths(await plan(['framework-express', 'arch-feature']))

    expect(files).toEqual(
      expect.arrayContaining([
        'src/features/.gitkeep',
        'src/shared/utils/.gitkeep',
        'src/shared/types/.gitkeep'
      ])
    )
  })

  it('MVC: controllers, models, services, routes, middlewares, utils, validators, config', async () => {
    const files = paths(await plan(['framework-express', 'arch-mvc']))

    for (const folder of ['controllers', 'models', 'services', 'utils', 'validators', 'config']) {
      expect(files).toContain(`src/${folder}/.gitkeep`)
    }
  })
})

describe('rate-limit algorithms (D-64)', () => {
  const limiter = async (algorithm?: string): Promise<GenerationPlan> =>
    plan(
      ['framework-express', 'security-rate-limit'],
      algorithm === undefined ? {} : { 'security-rate-limit': { algorithm } }
    )

  it.each([
    ['fixed-window', 'class FixedWindow'],
    ['sliding-window', 'class SlidingWindow'],
    ['token-bucket', 'class TokenBucket'],
    ['leaky-bucket', 'class LeakyBucket']
  ])('%s renders only its own algorithm, with a test', async (algorithm, className) => {
    const result = await limiter(algorithm)
    const source = content(result, 'src/lib/rate-limiter.ts')

    expect(source).toContain(className)
    expect(source.match(/^class /gm)).toHaveLength(1)
    expect(paths(result)).toContain('tests/rate-limit.test.ts')
  })

  it('defaults to a fixed window and needs no third-party limiter', async () => {
    const result = await limiter()
    const manifest = JSON.parse(content(result, 'package.json')) as {
      dependencies: Record<string, string>
    }

    expect(content(result, 'src/lib/rate-limiter.ts')).toContain('class FixedWindow')
    expect(manifest.dependencies['express-rate-limit']).toBeUndefined()
  })

  it('rejects an unknown algorithm', async () => {
    await expect(limiter('random')).rejects.toThrow(/algorithm/)
  })
})

describe('API versioning (D-64)', () => {
  it('mounts application routes under /v1 and keeps health unversioned (Express)', async () => {
    const app = content(await plan(['framework-express', 'api-versioning']), 'src/app.ts')

    expect(app).toContain("app.use('/v1', api)")
    expect(app.indexOf('createHealthRouter(')).toBeLessThan(app.indexOf("app.use('/v1', api)"))
  })

  it('serves routes at the root without versioning', async () => {
    const app = content(await plan(['framework-express']), 'src/app.ts')

    expect(app).toContain("app.use('/', api)")
  })

  it('versions Nest routes by URI and keeps the probes version-neutral (Nest)', async () => {
    const result = await plan(['framework-nest', 'api-versioning'])

    // URI versioning, unlike a global prefix, keeps Nest's 404 envelope on every path
    expect(content(result, 'src/app.ts')).toContain(
      "app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })"
    )
    expect(content(result, 'src/health/health.controller.ts')).toContain(
      '@Controller({ version: VERSION_NEUTRAL })'
    )
  })
})

describe('CORS', () => {
  it('leaves out CORS headers for other origins instead of failing the request with a 500', async () => {
    const cors = content(
      await plan(['framework-express', 'middleware-cors']),
      'src/middlewares/cors.ts'
    )

    expect(cors).toContain('callback(null, !origin || allowedOrigins.includes(origin))')
    expect(cors).not.toContain('new Error(')
  })
})

describe('process-level error handlers (D-64)', () => {
  it('logs unhandled rejections and uncaught exceptions, then exits', async () => {
    const shutdown = content(await plan(['framework-express']), 'src/lib/shutdown.ts')

    expect(shutdown).toContain("process.on('unhandledRejection'")
    expect(shutdown).toContain("process.on('uncaughtException'")
  })
})

const FULLSTACK = [
  'layout-monorepo',
  'framework-express',
  'orm-prisma',
  'middleware-cors',
  'framework-nextjs',
  'ui-tailwind',
  'api-versioning'
]

describe('frontend architectures (D-64)', () => {
  it.each([
    ['arch-web-feature', ['features/.gitkeep', 'components/.gitkeep', 'hooks/.gitkeep']],
    ['arch-web-layer', ['components/.gitkeep', 'services/.gitkeep', 'utils/.gitkeep']],
    ['arch-web-atomic', ['components/atoms/.gitkeep', 'components/organisms/.gitkeep']]
  ])('%s creates its folders in the web app', async (moduleId, folders) => {
    const files = paths(await plan([...FULLSTACK, moduleId]))

    for (const folder of folders) expect(files).toContain(`apps/web/${folder}`)
  })
})

describe('admin frontend (D-64)', () => {
  const withAdmin = [...FULLSTACK, 'app-admin', 'arch-web-feature']

  it('builds apps/admin from the same web modules, folders included', async () => {
    const files = paths(await plan(withAdmin))

    for (const file of [
      'apps/admin/package.json',
      'apps/admin/next.config.ts',
      'apps/admin/app/page.tsx',
      'apps/admin/app/health/route.ts',
      'apps/admin/postcss.config.mjs',
      'apps/admin/features/.gitkeep'
    ]) {
      expect(files).toContain(file)
    }
  })

  it('runs on its own port and is allowed by the API CORS list', async () => {
    const result = await plan(withAdmin)
    const admin = JSON.parse(content(result, 'apps/admin/package.json')) as {
      name: string
      scripts: Record<string, string>
      dependencies: Record<string, string>
    }

    expect(admin.name).toBe('@shop/admin')
    expect(admin.scripts.dev).toBe('next dev --port 3002')
    expect(admin.dependencies['@shop/shared']).toBe('workspace:*')
    expect(content(result, 'apps/api/.env')).toContain(
      'ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002'
    )
  })

  it('titles the admin pages and calls the versioned API', async () => {
    const result = await plan(withAdmin)

    expect(content(result, 'apps/admin/app/page.tsx')).toContain('shop admin')
    expect(content(result, 'apps/admin/lib/api.ts')).toContain("API_VERSION = '/v1'")
    expect(content(result, 'apps/web/app/page.tsx')).not.toContain('shop admin')
  })
})
