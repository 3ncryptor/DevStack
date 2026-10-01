import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'devops-docker',
  title: 'Docker and docker compose',
  category: 'devops',
  language: 'node',
  depth: 'bare',
  // the compose file runs the whole stack from the repository root (D-41)
  target: 'root',
  description: 'Production Dockerfiles and a docker compose file for the whole stack',
  files: [
    { path: 'Dockerfile', when: { not: { has: 'layout:monorepo' } } },
    { path: 'apps/api/Dockerfile', when: { has: 'layout:monorepo' } }
  ],
  filesPath: moduleFilesPath('devops-docker')
}

export default moduleDefinition
