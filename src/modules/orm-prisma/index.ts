import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'orm-prisma',
  title: 'Prisma + PostgreSQL',
  category: 'orm',
  language: 'node',
  provides: ['orm', 'db:postgres'],
  description: 'Prisma ORM with starter schema and client setup',
  requires: ['language-node'],
  dependencies: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'dotenv'],
  devDependencies: ['prisma'],
  filesPath: moduleFilesPath('orm-prisma'),
  packageJson: {
    scripts: {
      'prisma:generate': 'prisma generate',
      'prisma:migrate': 'prisma migrate dev',
      'prisma:studio': 'prisma studio'
    }
  },
  env: [
    {
      name: 'DATABASE_URL',
      description: 'PostgreSQL connection string',
      example: '"postgresql://postgres:postgres@localhost:5432/devstack"',
      required: true,
      secret: true
    }
  ],
  commands: [{ phase: 'postInstall', run: ['prisma', 'generate'] }]
}

export default moduleDefinition
