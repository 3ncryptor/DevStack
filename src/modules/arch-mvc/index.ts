import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-mvc',
  title: 'MVC',
  category: 'architecture',
  language: 'node',
  description: 'MVC oriented source folder structure',
  requires: ['language-node'],
  filesPath: moduleFilesPath('arch-mvc')
}

export default moduleDefinition
