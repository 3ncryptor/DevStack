import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'folder-clean',
  description: 'Clean architecture source folder structure',
  requires: ['language-node'],
  conflictsWith: ['folder-mvc'],
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
