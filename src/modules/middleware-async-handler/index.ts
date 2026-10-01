import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'middleware-async-handler',
  title: 'asyncHandler wrapper',
  category: 'middleware',
  language: 'node',
  description:
    'asyncHandler() for route handlers. Optional: Express 5 already forwards rejected promises',
  requires: ['framework-express'],
  filesPath: moduleFilesPath('middleware-async-handler')
}

export default moduleDefinition
