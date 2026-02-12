import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'folder-mvc',
  description: 'MVC oriented source folder structure',
  requires: ['language-node'],
  conflictsWith: ['folder-clean'],
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
