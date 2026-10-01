import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

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
  // Docker v2 (task 3.7) builds one image per app from the workspace; until then, no Docker here
  conflictsWith: ['devops-docker'],
  devDependencies: ['turbo', 'typescript'],
  filesPath: moduleFilesPath('layout-monorepo'),
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
