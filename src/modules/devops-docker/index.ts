import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'devops-docker',
  title: 'Docker and docker compose',
  category: 'devops',
  language: 'node',
  description: 'Basic Dockerfile and docker-compose setup',
  filesPath: moduleFilesPath('devops-docker')
}

export default moduleDefinition
