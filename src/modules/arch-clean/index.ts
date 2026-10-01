import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-clean',
  title: 'Clean architecture',
  category: 'architecture',
  language: 'node',
  description: 'Clean architecture source folder structure',
  requires: ['language-node'],
  filesPath: moduleFilesPath('arch-clean')
}

export default moduleDefinition
