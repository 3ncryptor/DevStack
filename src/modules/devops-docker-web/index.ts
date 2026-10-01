import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'devops-docker-web',
  title: 'Docker images for the web apps',
  category: 'devops',
  language: 'node',
  // every web app gets its image, the admin app included
  target: 'frontend',
  depth: 'bare',
  description: 'A Next.js standalone image per web app, built from the pruned workspace',
  requires: ['devops-docker', 'framework-nextjs'],
  filesPath: moduleFilesPath('devops-docker-web')
}

export default moduleDefinition
