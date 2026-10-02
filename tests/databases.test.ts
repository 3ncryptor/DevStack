import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { resolveStack } from '../src/core/resolver/index'
import type { GenerationPlan } from '../src/types/plan'

const registry = loadModules()

function plan(modules: string[]): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'data',
    projectDir: '/virtual/data',
    selectedModuleNames: ['framework-express', 'devops-docker', ...modules],
    registry,
    packageManager: 'pnpm',
    packageManagerVersion: '12.6.0',
    options: { skipInstall: false, skipGit: false }
  })
}

const content = (result: GenerationPlan, file: string): string =>
  result.files.find((candidate) => candidate.path === file)?.content ?? ''

interface Manifest {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
}
const manifest = (result: GenerationPlan): Manifest =>
  JSON.parse(content(result, 'package.json')) as Manifest

const diagnosticCodes = (modules: string[]): string[] =>
  resolveStack(['language-node', ...modules], registry).diagnostics.map(
    (diagnostic) => diagnostic.code
  )

describe('databases and ORMs (M4, D-77)', () => {
  it('connects Prisma through the driver adapter of the chosen database', async () => {
    const mysql = await plan(['database-mysql', 'orm-prisma'])
    const sqlite = await plan(['database-sqlite', 'orm-prisma'])

    expect(content(mysql, 'prisma/schema.prisma')).toContain('provider = "mysql"')
    expect(content(mysql, 'src/db/client.ts')).toContain('new PrismaMariaDb(')
    expect(Object.keys(manifest(mysql).dependencies)).toContain('@prisma/adapter-mariadb')
    expect(Object.keys(manifest(mysql).dependencies)).not.toContain('pg')
    expect(content(sqlite, 'prisma/schema.prisma')).toContain('provider = "sqlite"')
    expect(content(sqlite, 'src/db/client.ts')).toContain('new PrismaBetterSqlite3(')
  })

  it('gives Drizzle the dialect, driver and migration scripts of the database', async () => {
    const result = await plan(['database-sqlite', 'orm-drizzle'])
    const { dependencies, devDependencies, scripts } = manifest(result)

    expect(content(result, 'drizzle.config.mjs')).toContain("dialect: 'sqlite'")
    expect(content(result, 'src/db/client.ts')).toContain("from 'drizzle-orm/better-sqlite3'")
    expect(Object.keys(dependencies)).toEqual(
      expect.arrayContaining(['drizzle-orm', 'better-sqlite3'])
    )
    expect(Object.keys(devDependencies)).toContain('@types/better-sqlite3')
    expect(scripts['db:migrate']).toBe('drizzle-kit migrate --config drizzle.config.mjs')
  })

  it('registers readiness and shutdown for the database and Redis', async () => {
    const lifecycle = content(
      await plan(['database-mongodb', 'orm-mongoose', 'cache-redis']),
      'src/lifecycle.ts'
    )

    expect(lifecycle).toContain("{ name: 'db', check: checkDatabase }")
    expect(lifecycle).toContain("{ name: 'redis', check: checkRedis }")
    expect(lifecycle).toContain("{ name: 'redis', dispose: disconnectRedis }")
  })

  it('runs the database and Redis in compose, the app waiting for both', async () => {
    const result = await plan(['database-mysql', 'orm-drizzle', 'cache-redis'])
    const compose = content(result, 'docker-compose.yml')

    expect(compose).toContain('image: mysql:8.4')
    expect(compose).toContain('DATABASE_URL: mysql://root:mysql@db:3306/devstack')
    expect(compose).toContain('REDIS_URL: redis://redis:6379')
    expect(compose).toMatch(/depends_on:\n\s+db:\n.*\n\s+redis:/)
    expect(compose).toMatch(/volumes:\n {2}mysql_data:\n {2}redis_data:\n$/)
    expect(manifest(result).scripts['db:up']).toBe('docker compose up -d db')
    expect(manifest(result).scripts['redis:up']).toBe('docker compose up -d redis')
  })

  it('keeps SQLite in a file: no compose service, a volume for the container', async () => {
    const result = await plan(['database-sqlite', 'orm-prisma'])
    const compose = content(result, 'docker-compose.yml')

    expect(compose).not.toContain('  db:')
    expect(compose).toContain('DATABASE_URL: file:/app/data/dev.db')
    expect(content(result, 'Dockerfile')).toContain('chown node:node /app/data')
    expect(manifest(result).scripts['db:up']).toBeUndefined()
    expect(content(result, '.gitignore')).toContain('*.db')
  })

  it('needs a database the ORM supports', () => {
    expect(diagnosticCodes(['orm-prisma'])).toContain('unmet-requirement')
    expect(diagnosticCodes(['database-mongodb', 'orm-drizzle'])).toContain('unmet-requirement')
    expect(diagnosticCodes(['database-mysql', 'database-sqlite'])).toContain('single-select')
    // Mongoose brings MongoDB in
    expect(resolveStack(['orm-mongoose'], registry).modules.map((m) => m.id)).toContain(
      'database-mongodb'
    )
  })

  it('keeps auth on Prisma and Postgres for now', () => {
    expect(
      diagnosticCodes(['framework-express', 'database-mysql', 'orm-prisma', 'auth-jwt'])
    ).toContain('single-select')
    expect(diagnosticCodes(['framework-express', 'orm-prisma', 'auth-jwt'])).toEqual([])
  })
})
