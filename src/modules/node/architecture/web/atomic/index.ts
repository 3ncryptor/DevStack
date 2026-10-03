import { moduleFilesPath } from '../../../../../paths'
import type { DevstackModule } from '../../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-web-atomic',
  title: 'Atomic design (web)',
  category: 'architecture',
  language: 'node',
  wizard: {
    question: 'frontendArchitecture',
    order: 3,
    label: 'Atomic design',
    hint: 'atoms, molecules, organisms'
  },
  // every web app gets these folders, the admin app included (D-64)
  target: 'frontend',
  depth: 'bare',
  description: 'components/{atoms,molecules,organisms,templates} plus hooks/',
  requiresAny: ['web:next', 'web:vite'],
  filesPath: moduleFilesPath('node/architecture/web/atomic')
}

export default moduleDefinition
