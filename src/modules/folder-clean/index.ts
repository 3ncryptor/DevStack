import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'folder-clean',
  description: 'Clean architecture source folder structure',
  requires: ['language-node'],
  conflictsWith: ['folder-mvc'],
  filesPath: moduleFilesPath('folder-clean')
}

export default moduleDefinition
