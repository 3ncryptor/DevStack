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
  description:
    'An image per web app from the pruned workspace: the Next.js standalone server, or nginx for React + Vite',
  requires: ['devops-docker'],
  requiresAny: ['framework-nextjs', 'framework-react-vite'],
  files: [{ path: 'nginx.conf.template', when: { has: 'framework-react-vite' } }],
  filesPath: moduleFilesPath('devops-docker-web')
}

export default moduleDefinition
