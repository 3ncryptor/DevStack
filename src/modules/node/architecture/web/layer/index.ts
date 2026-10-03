import { moduleFilesPath } from '../../../../../paths'
import type { DevstackModule } from '../../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-web-layer',
  title: 'Layer-based (web)',
  category: 'architecture',
  language: 'node',
  wizard: {
    question: 'frontendArchitecture',
    order: 2,
    label: 'Layer-based',
    hint: 'components/, hooks/, utils/'
  },
  // every web app gets these folders, the admin app included (D-64)
  target: 'frontend',
  depth: 'bare',
  description: 'components/, hooks/, services/, utils/, types/ and constants/ at the top level',
  requiresAny: ['framework-nextjs', 'framework-react-vite'],
  filesPath: moduleFilesPath('node/architecture/web/layer')
}

export default moduleDefinition
