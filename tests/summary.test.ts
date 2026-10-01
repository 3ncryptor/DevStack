import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import { buildSummary } from '../src/core/summary'
import type { PackageManager } from '../src/utils/package-manager'

const BACKEND_MODULES = [...(getPreset('backend')?.modules ?? [])]

async function planFor(
  modules: string[],
  packageManager: PackageManager = 'pnpm',
  skipInstall = false
) {
  return buildGenerationPlan({
    projectName: 'summary-app',
    projectDir: '/work/summary-app',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager,
    options: { skipInstall, skipGit: false }
  })
}

const noResult = { written: [], overwritten: [], kept: [] }

describe('.env.example from module env declarations', () => {
  it('lists every declared variable once, grouped by module, with descriptions', async () => {
    const plan = await planFor(BACKEND_MODULES)
    const example = plan.files.find((file) => file.path === '.env.example')?.content ?? ''

    expect(example).toContain('DATABASE_URL=')
    expect(example).toContain('PORT=3000')
    expect(example.match(/^ALLOWED_ORIGINS=/gm)).toHaveLength(1)
    expect(example).toMatch(/# orm-prisma\n# PostgreSQL connection string/)
  })
})

describe('buildSummary', () => {
  it('gives the next commands in the project package manager', async () => {
    const plan = await planFor(BACKEND_MODULES, 'pnpm')

    const summary = buildSummary(plan, noResult, { inPlace: false, skipInstall: false })

    expect(summary).toContain('cd summary-app')
    expect(summary).toContain('cp .env.example .env')
    expect(summary).toContain('pnpm run prisma:migrate')
    expect(summary).toContain('pnpm run dev')
    expect(summary).not.toContain('pnpm install')
  })

  it('tells the user to install when installation was skipped', async () => {
    const plan = await planFor(BACKEND_MODULES, 'npm', true)

    const summary = buildSummary(plan, noResult, { inPlace: false, skipInstall: true })

    expect(summary).toContain('npm install')
  })

  it('lists required variables and warns about permissive defaults', async () => {
    const plan = await planFor(BACKEND_MODULES)

    const summary = buildSummary(plan, noResult, { inPlace: false, skipInstall: false })

    expect(summary).toMatch(/DATABASE_URL\s+required/)
    expect(summary).toMatch(/ALLOWED_ORIGINS.*any origin/)
  })

  it('reports kept files and where overwritten originals were saved', async () => {
    const plan = await planFor(BACKEND_MODULES)

    const summary = buildSummary(
      plan,
      {
        written: ['a'],
        overwritten: ['src/app.ts'],
        kept: ['README.md'],
        backupDir: '/tmp/backup'
      },
      { inPlace: true, skipInstall: false }
    )

    expect(summary).not.toContain('cd summary-app')
    expect(summary).toContain('README.md')
    expect(summary).toContain('/tmp/backup')
  })
})

describe('docker-basic templates', () => {
  const dockerModules = (extra: string[]) => ['framework-express', 'docker-basic', ...extra]

  it('builds a multi-stage, non-root image with the project package manager', async () => {
    const plan = await planFor(dockerModules(['orm-prisma']), 'pnpm')
    const dockerfile = plan.files.find((file) => file.path === 'Dockerfile')?.content ?? ''

    expect(dockerfile.match(/^FROM /gm)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(dockerfile).toContain('USER node')
    expect(dockerfile).toContain('pnpm install --frozen-lockfile')
    expect(dockerfile).toContain('pnpm exec prisma generate')
    expect(dockerfile).toContain('CMD ["node", "dist/server.js"]')
    expect(dockerfile).toContain('HEALTHCHECK')
  })

  it('starts the Nest entry point for Nest projects', async () => {
    const plan = await planFor(['framework-nest', 'docker-basic'], 'npm')
    const dockerfile = plan.files.find((file) => file.path === 'Dockerfile')?.content ?? ''

    expect(dockerfile).toContain('RUN npm ci')
    expect(dockerfile).toContain('npm ci --omit=dev --omit=optional --ignore-scripts')
    expect(dockerfile).toContain('CMD ["node", "dist/main.js"]')
    expect(dockerfile).not.toContain('prisma generate')
  })

  it('adds a database service to compose only when a database is selected', async () => {
    const withDb = await planFor(dockerModules(['orm-prisma']))
    const withoutDb = await planFor(dockerModules([]))
    const compose = (plan: typeof withDb) =>
      plan.files.find((file) => file.path === 'docker-compose.yml')?.content ?? ''

    expect(compose(withDb)).toContain('postgres:')
    expect(compose(withDb)).toContain('condition: service_healthy')
    expect(compose(withoutDb)).not.toContain('postgres')
    expect(compose(withDb)).not.toMatch(/^version:/m)
    expect(compose(withDb)).toContain('${POSTGRES_PORT:-5432}:5432')
    expect(compose(withoutDb)).toContain('${PORT:-3000}:3000')
  })
})
