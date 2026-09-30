import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'docker-basic',
  description: 'Basic Dockerfile and docker-compose setup',
  filesPath: moduleFilesPath('docker-basic')
}

export default moduleDefinition
