import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

/**
 * CSS Modules (M4, D-79): each page's root element takes a class from app/ui.module.css, local
 * to that module, and the elements inside are styled under it, so no style leaks between pages.
 */
const moduleDefinition: DevstackModule = {
  id: 'ui-css-modules',
  title: 'CSS Modules',
  category: 'styling',
  language: 'node',
  target: 'frontend',
  depth: 'bare',
  description: 'Locally scoped styles with CSS Modules (app/ui.module.css), no extra dependency',
  requiresAny: ['framework-nextjs', 'framework-react-vite'],
  filesPath: moduleFilesPath('ui-css-modules')
}

export default moduleDefinition
