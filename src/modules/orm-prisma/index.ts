import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'orm-prisma',
  description: 'Prisma ORM with starter schema and client setup',
  requires: ['language-node'],
  dependencies: {
    '@prisma/client': '^6.1.0'
  },
  devDependencies: {
    prisma: '^6.1.0'
  },
  filesPath: moduleFilesPath('orm-prisma'),
  packageJson: {
    scripts: {
      'prisma:generate': 'prisma generate',
      'prisma:migrate': 'prisma migrate dev',
      'prisma:studio': 'prisma studio'
    }
  },
  postInstall: async (context) => {
    if (context.options.skipInstall) {
      context.logger.warn('Skipping prisma generate because --skip-install is enabled.')
      return
    }

    await context.runPackageManagerExec('prisma', ['generate'])
  }
}

export default moduleDefinition
