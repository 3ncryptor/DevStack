import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'framework-nest',
  title: 'NestJS',
  category: 'framework',
  language: 'node',
  provides: ['http-framework'],
  description: 'NestJS application starter',
  requires: ['language-node', 'core-backend'],
  dependencies: [
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-express',
    'reflect-metadata',
    'rxjs'
  ],
  // SWC keeps decorator metadata in dev, which Nest's dependency injection needs (D-51)
  // unplugin-swc: Vitest compiles Nest tests with SWC, which keeps decorator metadata
  devDependencies: ['@swc-node/register', '@swc/core', '@types/express', 'unplugin-swc'],
  files: [{ path: 'vitest.config.ts', when: { has: 'testing-vitest' }, depth: 'wired' }],
  exposesSlots: ['app.imports', 'app.middleware'],
  env: [
    {
      name: 'PORT',
      description: 'Port the HTTP server listens on',
      example: '3000',
      required: false,
      schema: 'z.coerce.number().int().min(1).max(65535).default(3000)'
    }
  ],
  filesPath: moduleFilesPath('framework-nest'),
  // wired only: at bare there is no src/main.ts and language-node's src/index.ts scripts apply
  scripts: [
    {
      name: 'dev',
      run: 'node --watch --import @swc-node/register/esm-register src/main.ts',
      depth: 'wired'
    },
    { name: 'start', run: 'node dist/main.js', depth: 'wired' },
    {
      name: 'test',
      run: 'node --import @swc-node/register/esm-register --test "tests/**/*.test.ts"',
      depth: 'wired',
      when: { not: { has: 'testing-vitest' } }
    }
  ]
}

export default moduleDefinition
