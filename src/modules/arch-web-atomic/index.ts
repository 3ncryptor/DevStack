import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-web-atomic',
  title: 'Atomic design (web)',
  category: 'architecture',
  language: 'node',
  // every web app gets these folders, the admin app included (D-64)
  target: 'frontend',
  depth: 'bare',
  description: 'components/{atoms,molecules,organisms,templates} plus hooks/',
  requiresAny: ['framework-nextjs', 'framework-react-vite'],
  filesPath: moduleFilesPath('arch-web-atomic')
}

export default moduleDefinition
