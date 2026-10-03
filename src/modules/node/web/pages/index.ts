import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

/** Any auth module on the API: the web apps get login pages (D-43). */
const AUTH: Condition = { has: 'auth' }
/** Registration and the account page are for the web app; admins are promoted (D-67). */
const WEB_AUTH: Condition = { all: [AUTH, { target: 'frontend' }] }
/** The Todo template's page lives in the web app (B17.8). */
const WEB_TODO: Condition = { all: [{ has: 'template-todo' }, { target: 'frontend' }] }

/**
 * What every web framework shares (D-79): the API client, the auth pages and client, the Todo
 * page. Next.js and React + Vite use the same app/ and lib/ layout, so these files are written
 * once; the few framework calls (routing hooks, public env) branch inside the templates.
 */
const moduleDefinition: DevstackModule = {
  id: 'web-pages',
  title: 'Web pages',
  category: 'misc',
  language: 'node',
  target: 'frontend',
  provides: ['web-pages'],
  description: 'The API client, auth pages and Todo page shared by the web frameworks',
  requiresAny: ['web:next', 'web:vite'],
  files: [
    { path: 'lib/auth/index.ts', when: AUTH },
    { path: 'lib/auth/session.ts', when: AUTH },
    { path: 'lib/auth/form.ts', when: AUTH },
    { path: 'lib/auth/require-auth.tsx', when: AUTH },
    { path: 'app/login/page.tsx', when: AUTH },
    { path: 'app/register/page.tsx', when: WEB_AUTH },
    { path: 'app/account/page.tsx', when: WEB_AUTH },
    { path: 'lib/todos.ts', when: WEB_TODO },
    { path: 'app/todos/page.tsx', when: WEB_TODO }
  ],
  filesPath: moduleFilesPath('node/web/pages')
}

export default moduleDefinition
