import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  name: 'framework-nest',
  description: 'NestJS application starter',
  requires: ['language-node'],
  conflictsWith: ['framework-express'],
  dependencies: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-express',
    'reflect-metadata',
    'rxjs'
  ],
  // SWC keeps decorator metadata in dev, which Nest's dependency injection needs (D-51)
  devDependencies: ['@swc-node/register', '@swc/core'],
  exposesSlots: ['app.imports', 'app.middleware'],
  env: [
    {
      name: 'PORT',
      description: 'Port the HTTP server listens on',
      example: '3000',
      required: false
    }
  ],
  filesPath: moduleFilesPath('framework-nest'),
  packageJson: {
    scripts: {
      dev: 'node --watch --import @swc-node/register/esm-register src/main.ts',
      start: 'node dist/main.js'
    }
  }
}

export default moduleDefinition
