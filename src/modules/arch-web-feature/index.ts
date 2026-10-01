import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-web-feature',
  title: 'Feature-based (web)',
  category: 'architecture',
  language: 'node',
  // every web app gets these folders, the admin app included (D-64)
  target: 'frontend',
  depth: 'bare',
  description: 'features/<name> per feature, plus shared components/, hooks/ and types/',
  requires: ['framework-nextjs'],
  filesPath: moduleFilesPath('arch-web-feature')
}

export default moduleDefinition
