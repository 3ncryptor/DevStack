import { moduleFilesPath } from '../../../../../paths'
import type { DevstackModule } from '../../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-clean',
  title: 'Clean architecture',
  category: 'architecture',
  language: 'node',
  depth: 'bare',
  description: 'Clean architecture source folder structure',
  requires: ['language-node'],
  filesPath: moduleFilesPath('node/architecture/api/clean')
}

export default moduleDefinition
