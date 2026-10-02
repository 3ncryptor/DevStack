import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

/**
 * React + Vite (M4, D-79): a single-page app with React Router, in the same app/ and lib/ layout
 * as the Next.js app, so the pages in web-pages, the web folder architectures and the web tests
 * are shared. The status page asks the API from the browser, through the /api proxy.
 */
const moduleDefinition: DevstackModule = {
  id: 'framework-react-vite',
  title: 'React + Vite',
  category: 'framework',
  language: 'node',
  target: 'frontend',
  provides: ['web-framework'],
  description:
    'React 19 single-page app on Vite with React Router, a status page and an /api proxy',
  requires: ['layout:monorepo', 'shared-api', 'web-pages'],
  dependencies: ['react', 'react-dom', 'react-router', 'zod'],
  devDependencies: [
    'vite',
    '@vitejs/plugin-react',
    '@types/node',
    '@types/react',
    '@types/react-dom',
    'typescript'
  ],
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
      description: 'Where the dev and preview servers proxy /api to',
      example: 'http://localhost:3001',
      required: false
    },
    {
      name: 'VITE_API_URL',
      description: 'Where the browser calls the API in production (split origin); unset uses /api',
      required: false
    }
  ],
  filesPath: moduleFilesPath('framework-react-vite'),
  packageJson: {
    // vite.config.ts and the app are ESM
    type: 'module',
    scripts: {
      // the port comes from PORT or the app's default (D-30), read in vite.config.ts
      dev: 'vite',
      build: 'vite build',
      start: 'vite preview',
      typecheck: 'tsc --noEmit'
    }
  }
}

export default moduleDefinition
