import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'docker-basic',
  description: 'Basic Dockerfile and docker-compose setup',
  filesPath: path.join(__dirname, 'files')
}

export default moduleDefinition
