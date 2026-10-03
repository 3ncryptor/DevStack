import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'ui-tailwind',
  title: 'Tailwind CSS',
  category: 'styling',
  language: 'node',
  wizard: { question: 'styling', order: 1 },
  vscodeExtensions: ['bradlc.vscode-tailwindcss'],
  target: 'frontend',
  depth: 'bare',
  // PostCSS works for both: Next.js and Vite read postcss.config.mjs
  description: 'Tailwind CSS 4 through PostCSS for the web app',
  requiresAny: ['web:next', 'web:vite'],
  devDependencies: ['tailwindcss', '@tailwindcss/postcss', 'postcss'],
  filesPath: moduleFilesPath('node/ui/tailwind')
}

export default moduleDefinition
