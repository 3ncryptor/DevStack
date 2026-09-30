import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'framework-express',
  description: 'Express HTTP server setup',
  requires: ['language-node'],
  dependencies: ['express'],
  exposesSlots: ['app.imports', 'app.middleware'],
  env: [
    {
      name: 'PORT',
      description: 'Port the HTTP server listens on',
      example: '3000',
      required: false
    }
  ],
  filesPath: moduleFilesPath('framework-express'),
  packageJson: {
    scripts: {
      dev: 'tsx watch src/server.ts',
      start: 'node dist/server.js'
    }
  }
}

export default moduleDefinition
