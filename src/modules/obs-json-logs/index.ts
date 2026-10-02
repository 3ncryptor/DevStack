import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

/** Plain JSON logs with no dependency (task 4.3, D-72, D-76); pino is the default. */
const moduleDefinition: DevstackModule = {
  id: 'obs-json-logs',
  title: 'Plain JSON logs',
  category: 'observability',
  language: 'node',
  description: 'JSON lines on stdout with no logging library, behind the same logger interface',
  requires: ['core-backend'],
  conflictsWith: ['obs-winston'],
  filesPath: moduleFilesPath('obs-json-logs')
}

export default moduleDefinition
