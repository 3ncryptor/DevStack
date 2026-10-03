import { moduleFilesPath } from '../../../../../paths'
import type { DevstackModule } from '../../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-mvc',
  title: 'MVC',
  category: 'architecture',
  language: 'node',
  wizard: { question: 'architecture', order: 3 },
  // Nest brings its own module layout
  conflictsWith: ['framework-nest'],
  depth: 'bare',
  description: 'MVC oriented source folder structure',
  requires: ['language-node'],
  filesPath: moduleFilesPath('node/architecture/api/mvc')
}

export default moduleDefinition
