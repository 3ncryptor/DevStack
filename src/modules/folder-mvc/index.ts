import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'folder-mvc',
  description: 'MVC oriented source folder structure',
  requires: ['language-node'],
  conflictsWith: ['folder-clean'],
  filesPath: moduleFilesPath('folder-mvc')
}

export default moduleDefinition
