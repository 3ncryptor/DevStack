import path from 'node:path'

import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'framework-nest',
  description: 'NestJS application starter',
  requires: ['language-node'],
  conflictsWith: ['framework-express'],
  dependencies: {
    '@nestjs/common': '^11.0.0',
    '@nestjs/core': '^11.0.0',
    '@nestjs/platform-express': '^11.0.0',
    'reflect-metadata': '^0.2.2',
    rxjs: '^7.8.1'
  },
  filesPath: path.join(__dirname, 'files'),
  packageJson: {
    scripts: {
      dev: 'tsx watch src/main.ts',
      start: 'node dist/main.js'
    }
  }
}

export default moduleDefinition
