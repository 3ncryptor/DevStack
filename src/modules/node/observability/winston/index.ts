import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

/** Winston behind the app's logger interface (task 4.3, D-72, D-76); pino is the default. */
const moduleDefinition: DevstackModule = {
  id: 'obs-winston',
  title: 'Winston logger',
  category: 'observability',
  language: 'node',
  description: 'Winston for JSON logs, behind the same logger interface as pino',
  requires: ['core-backend'],
  conflictsWith: ['obs-json-logs'],
  dependencies: ['winston'],
  filesPath: moduleFilesPath('node/observability/winston')
}

export default moduleDefinition
