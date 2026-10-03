import { moduleFilesPath } from '../../../../../paths'
import type { DevstackModule } from '../../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'arch-feature',
  title: 'Feature-scoped',
  category: 'architecture',
  language: 'node',
  wizard: { question: 'architecture', order: 1, hint: 'src/features/<name> per domain' },
  // Nest brings its own module layout
  conflictsWith: ['framework-nest'],
  depth: 'bare',
  // each domain keeps its service, repository, routes and tests in src/features/<name> (B17.6)
  description: 'Feature-scoped folders: src/features/<name> per domain, src/shared for the rest',
  requires: ['language-node'],
  filesPath: moduleFilesPath('node/architecture/api/feature')
}

export default moduleDefinition
