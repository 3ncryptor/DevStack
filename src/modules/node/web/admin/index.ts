import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'app-admin',
  title: 'Admin frontend',
  category: 'misc',
  language: 'node',
  // apps/admin is built from the same web modules as apps/web (D-64)
  target: 'admin',
  provides: ['admin-app'],
  description: 'A second Next.js app in apps/admin (port 3002) sharing the API and packages/shared',
  requires: ['framework-nextjs']
}

export default moduleDefinition
