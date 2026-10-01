import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'ui-tailwind',
  title: 'Tailwind CSS',
  category: 'styling',
  language: 'node',
  target: 'frontend',
  depth: 'bare',
  description: 'Tailwind CSS 4 through PostCSS for the web app',
  requires: ['framework-nextjs'],
  devDependencies: ['tailwindcss', '@tailwindcss/postcss', 'postcss'],
  filesPath: moduleFilesPath('ui-tailwind')
}

export default moduleDefinition
