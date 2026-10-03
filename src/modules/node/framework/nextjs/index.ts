import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'framework-nextjs',
  title: 'Next.js',
  category: 'framework',
  language: 'node',
  wizard: { question: 'frontend', order: 1 },
  target: 'frontend',
  provides: ['web-framework'],
  description:
    'Next.js 16 (App Router) web app with a status page and a development proxy to the API',
  // fullstack for now (apps/web next to apps/api); a frontend-only app type comes later
  requires: ['layout:monorepo', 'shared-api', 'web-pages'],
  dependencies: ['next', 'react', 'react-dom', 'zod'],
  devDependencies: ['@types/node', '@types/react', '@types/react-dom', 'typescript'],
  files: [
    {
      path: 'app/globals.css',
      // Tailwind and CSS Modules bring their own
      when: { not: { any: [{ has: 'ui-tailwind' }, { has: 'ui-css-modules' }] } }
    }
  ],
  env: [
    {
      name: 'API_URL',
      description: 'Where the web server reaches the API: status page and development proxy',
      example: 'http://localhost:3001',
      required: false,
      schema: "z.url().default('http://localhost:3001')"
    },
    {
      name: 'NEXT_PUBLIC_API_URL',
      description: 'Where the browser calls the API in production (split origin); unset uses /api',
      required: false
    }
  ],
  filesPath: moduleFilesPath('node/framework/nextjs'),
  packageJson: {
    scripts: {
      // each web app fills in its own port: web 3000, admin 3002 (D-30, D-64)
      dev: 'next dev --port {{port}}',
      build: 'next build',
      start: 'next start',
      // next typegen writes next-env.d.ts and the route types tsc needs
      typecheck: 'next typegen && tsc --noEmit'
    }
  }
}

export default moduleDefinition
