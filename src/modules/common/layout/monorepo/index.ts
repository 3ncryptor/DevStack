import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'layout-monorepo',
  title: 'Monorepo (workspaces + Turborepo)',
  category: 'layout',
  language: 'node',
  depth: 'bare',
  target: 'root',
  provides: ['layout:monorepo'],
  description: 'apps/api, apps/web and packages/* in one workspace, orchestrated by Turborepo',
  requires: ['language-node'],
  devDependencies: ['turbo', 'typescript'],
  filesPath: moduleFilesPath('common/layout/monorepo'),
  packageJson: {
    scripts: {
      dev: 'turbo run dev',
      build: 'turbo run build',
      typecheck: 'turbo run typecheck',
      test: 'turbo run test'
    }
  }
}

export default moduleDefinition
