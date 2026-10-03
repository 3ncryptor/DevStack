import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

/** The driver adapter Prisma 7 connects through, per database (D-77). */
const ADAPTERS = [
  { name: '@prisma/adapter-pg', when: { has: 'db:postgres' } },
  { name: 'pg', when: { has: 'db:postgres' } },
  { name: '@prisma/adapter-mariadb', when: { has: 'db:mysql' } },
  { name: '@prisma/adapter-better-sqlite3', when: { has: 'db:sqlite' } }
] as const

const moduleDefinition: DevstackModule = {
  id: 'orm-prisma',
  title: 'Prisma',
  category: 'orm',
  language: 'node',
  depth: 'bare',
  // schema and config are tooling; the client wrapper is integration code
  files: [{ path: 'src/db/client.ts', depth: 'wired' }],
  provides: ['orm'],
  description: 'Prisma ORM with starter schema and client setup, on PostgreSQL, MySQL or SQLite',
  requires: ['language-node'],
  requiresAny: ['db:postgres', 'db:mysql', 'db:sqlite'],
  dependencies: ['@prisma/client', ...ADAPTERS, 'dotenv'],
  devDependencies: ['prisma'],
  filesPath: moduleFilesPath('node/orm/prisma'),
  packageJson: {
    scripts: {
      'db:generate': 'prisma generate',
      'db:migrate': 'prisma migrate dev',
      'db:reset': 'prisma migrate reset',
      'db:studio': 'prisma studio'
    }
  },
  // readiness and shutdown through the baseline's lifecycle slots (B17.3); without a framework
  // there is no lifecycle, and the client is used directly
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
  ],
  exposesSlots: ['prisma.models'],
  commands: [{ phase: 'postInstall', run: ['prisma', 'generate'] }]
}

export default moduleDefinition
