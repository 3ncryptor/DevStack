import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import type { GenerationPlan } from '../src/types/plan'

function plan(
  modules: string[],
  packageManager: 'pnpm' | 'npm' | 'bun' = 'pnpm'
): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'ops',
    projectDir: '/virtual/ops',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager,
    packageManagerVersion: packageManager === 'bun' ? '1.4.0' : '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const paths = (result: GenerationPlan): string[] => result.files.map((file) => file.path)
const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''

const FULLSTACK = [
  'layout-monorepo',
  'framework-express',
  'database-postgres',
  'orm-prisma',
  'framework-nextjs',
  'app-admin',
  'devops-docker',
  'devops-docker-web'
]

describe('Docker v2 in a monorepo (task 3.7, D-41)', () => {
  it('writes one Dockerfile per app and one compose file for the whole stack', async () => {
    const files = paths(await plan(FULLSTACK))

    expect(files).toEqual(
      expect.arrayContaining([
        'apps/api/Dockerfile',
        'apps/web/Dockerfile',
        'apps/admin/Dockerfile',
        'docker-compose.yml',
        '.dockerignore'
      ])
    )
    expect(files).not.toContain('Dockerfile')
  })

  it('builds each image from the pruned workspace', async () => {
    const result = await plan(FULLSTACK)

    expect(content(result, 'apps/api/Dockerfile')).toContain('turbo prune @ops/api --docker')
    expect(content(result, 'apps/admin/Dockerfile')).toContain('turbo prune @ops/admin --docker')
    expect(content(result, 'apps/web/Dockerfile')).toContain('CMD ["node", "apps/web/server.js"]')
  })

  it('starts db, api, web and admin in dependency order through healthchecks', async () => {
    const compose = content(await plan(FULLSTACK), 'docker-compose.yml')

    for (const service of ['db:', 'api:', 'web:', 'admin:'])
      expect(compose).toContain(`  ${service}`)
    expect(compose).toContain('dockerfile: apps/api/Dockerfile')
    expect(compose).toContain('API_URL: http://api:3001')
    expect(compose.match(/condition: service_healthy/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('builds the web apps standalone only when they are containerised', async () => {
    const withDocker = content(await plan(FULLSTACK), 'apps/web/next.config.ts')
    const without = content(
      await plan(FULLSTACK.filter((id) => !id.startsWith('devops-'))),
      'apps/web/next.config.ts'
    )

    expect(withDocker).toContain("output: 'standalone'")
    expect(without).not.toContain('standalone')
  })

  it('ignores secrets, dependencies and build output in every workspace', async () => {
    const ignore = content(await plan(FULLSTACK), '.dockerignore').split('\n')

    for (const entry of ['**/node_modules', '**/.env', '**/dist', '**/.next', '!**/.env.example']) {
      expect(ignore).toContain(entry)
    }
  })

  it('keeps the single-layout Dockerfile at the root', async () => {
    const files = paths(await plan(['framework-express', 'devops-docker']))

    expect(files).toContain('Dockerfile')
    expect(files).not.toContain('apps/api/Dockerfile')
  })
})

describe('GitHub Actions (task 3.7)', () => {
  it('installs with the project package manager and runs every gate', async () => {
    const workflow = content(
      await plan([
        'framework-express',
        'database-postgres',
        'orm-prisma',
        'quality-eslint',
        'quality-prettier',
        'devops-github-actions'
      ]),
      '.github/workflows/ci.yml'
    )

    expect(workflow).toContain('uses: actions/checkout@v7')
    expect(workflow).toContain('uses: pnpm/action-setup@v6')
    expect(workflow).toContain('run: pnpm install --frozen-lockfile')
    for (const gate of ['lint', 'format', 'typecheck', 'build', 'test']) {
      expect(workflow).toContain(`run: pnpm run ${gate}`)
    }
    expect(workflow).toContain('prisma generate')
    expect(workflow).toContain('contents: read')
  })

  it('uses setup-bun for bun', async () => {
    const workflow = content(
      await plan(['framework-express', 'devops-github-actions'], 'bun'),
      '.github/workflows/ci.yml'
    )

    expect(workflow).toContain('uses: oven-sh/setup-bun@v2')
    expect(workflow).not.toContain('pnpm')
  })
})

describe('Scalar API docs (task 4.4, M2 slice)', () => {
  it('serves /docs and /openapi.json before the security headers, and tests them', async () => {
    const result = await plan(['framework-express', 'security-helmet', 'api-docs-scalar'])
    const app = content(result, 'src/app.ts')

    expect(paths(result)).toEqual(
      expect.arrayContaining(['src/docs/openapi.ts', 'src/routes/docs.ts', 'tests/docs.test.ts'])
    )
    expect(app.indexOf('createDocsRouter(')).toBeGreaterThan(-1)
    expect(app.indexOf('createDocsRouter(')).toBeLessThan(app.indexOf('helmetMiddleware)'))
  })

  it('documents the versioned routes when the API is versioned', async () => {
    const spec = content(
      await plan(['framework-express', 'api-versioning', 'api-docs-scalar']),
      'src/docs/openapi.ts'
    )

    expect(spec).toContain("'/v1'")
    expect(spec).toContain("'/health'")
  })
})
