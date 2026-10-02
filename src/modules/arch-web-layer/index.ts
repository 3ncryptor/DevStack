import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-web-layer',
  title: 'Layer-based (web)',
  category: 'architecture',
  language: 'node',
  // every web app gets these folders, the admin app included (D-64)
  target: 'frontend',
  depth: 'bare',
  description: 'components/, hooks/, services/, utils/, types/ and constants/ at the top level',
  requiresAny: ['framework-nextjs', 'framework-react-vite'],
  filesPath: moduleFilesPath('arch-web-layer')
}

export default moduleDefinition
