import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'orm-prisma',
  title: 'Prisma + PostgreSQL',
  category: 'orm',
  language: 'node',
  depth: 'bare',
  // schema and config are tooling; the client wrapper is integration code
  files: [{ path: 'src/db/client.ts', depth: 'wired' }],
  provides: ['orm', 'db:postgres'],
  description: 'Prisma ORM with starter schema and client setup',
  requires: ['language-node'],
  dependencies: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'dotenv'],
  devDependencies: ['prisma'],
  filesPath: moduleFilesPath('orm-prisma'),
  packageJson: {
    scripts: {
      'db:generate': 'prisma generate',
      'db:migrate': 'prisma migrate dev',
      'db:reset': 'prisma migrate reset',
      'db:studio': 'prisma studio'
    }
  },
  // the compose file has a database service only when Prisma is selected (devops-docker)
  scripts: [
    { name: 'db:up', run: 'docker compose up -d db', when: { has: 'devops-docker' } },
    { name: 'db:down', run: 'docker compose down', when: { has: 'devops-docker' } }
  ],
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
  env: [
    {
      name: 'DATABASE_URL',
      description: 'PostgreSQL connection string',
      example: '"postgresql://postgres:postgres@localhost:5432/devstack"',
      required: true,
      secret: true,
      schema: 'z.url()'
    }
  ],
  exposesSlots: ['prisma.models'],
  commands: [{ phase: 'postInstall', run: ['prisma', 'generate'] }]
}

export default moduleDefinition
