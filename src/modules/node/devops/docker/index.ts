import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'devops-docker',
  title: 'Docker and docker compose',
  category: 'devops',
  language: 'node',
  vscodeExtensions: ['ms-azuretools.vscode-docker'],
  depth: 'bare',
  // the compose file runs the whole stack from the repository root (D-41)
  target: 'root',
  description: 'Production Dockerfiles and a docker compose file for the whole stack',
  files: [
    { path: 'Dockerfile', when: { not: { has: 'layout:monorepo' } } },
    // __api__: the API's folder in a monorepo, apps/api unless the settings name it otherwise
    { path: '__api__/Dockerfile', when: { has: 'layout:monorepo' } }
  ],
  filesPath: moduleFilesPath('node/devops/docker')
}

export default moduleDefinition
