import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'orm-prisma',
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
  commands: [{ phase: 'postInstall', run: ['prisma', 'generate'] }]
}

export default moduleDefinition
