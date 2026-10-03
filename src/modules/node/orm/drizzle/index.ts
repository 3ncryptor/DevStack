import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const POSTGRES = { has: 'db:postgres' } as const
const MYSQL = { has: 'db:mysql' } as const
const SQLITE = { has: 'db:sqlite' } as const

/**
 * Drizzle ORM (M4, D-77): a typed schema in TypeScript, SQL migrations from drizzle-kit, and the
 * driver for the chosen database. Readiness and shutdown use the same slots as Prisma.
 */
const moduleDefinition: DevstackModule = {
  id: 'orm-drizzle',
  title: 'Drizzle',
  category: 'orm',
  language: 'node',
  depth: 'bare',
  files: [{ path: 'src/db/client.ts', depth: 'wired' }],
  provides: ['orm'],
  description:
    'Drizzle ORM with a TypeScript schema and drizzle-kit migrations, on PostgreSQL, MySQL or SQLite',
  requires: ['language-node'],
  requiresAny: ['db:postgres', 'db:mysql', 'db:sqlite'],
  dependencies: [
    'drizzle-orm',
    'dotenv',
    { name: 'pg', when: POSTGRES },
    { name: 'mysql2', when: MYSQL },
    { name: 'better-sqlite3', when: SQLITE }
  ],
  devDependencies: [
    'drizzle-kit',
    { name: '@types/pg', when: POSTGRES },
    { name: '@types/better-sqlite3', when: SQLITE }
  ],
  filesPath: moduleFilesPath('node/orm/drizzle'),
  packageJson: {
    scripts: {
      'db:generate': 'drizzle-kit generate --config drizzle.config.mjs',
      'db:migrate': 'drizzle-kit migrate --config drizzle.config.mjs',
      'db:studio': 'drizzle-kit studio --config drizzle.config.mjs'
    }
  },
  slots: [
    {
      slot: 'lifecycle.imports',
      code: "import { checkDatabase, disconnectDatabase } from './db/client.js'",
      when: { has: 'core-backend' },
      depth: 'wired'
    },
    {
      slot: 'app.readiness',
      code: "{ name: 'db', check: checkDatabase },",
      when: { has: 'core-backend' },
      depth: 'wired'
    },
    {
      slot: 'app.shutdown',
      code: "{ name: 'db', dispose: disconnectDatabase },",
      when: { has: 'core-backend' },
      depth: 'wired'
    }
  ]
}

export default moduleDefinition
