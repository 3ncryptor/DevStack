import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

/**
 * Jest for the API tests (M4, D-75): the same generated tests as Vitest and node:test, with
 * `test` from @jest/globals. SWC compiles TypeScript (with decorator metadata, which Nest needs);
 * an ESM project's tests run as ES modules, a CommonJS project's as CommonJS (D-91).
 */
const moduleDefinition: DevstackModule = {
  id: 'testing-jest',
  title: 'Jest',
  category: 'testing',
  language: 'node',
  wizard: { question: 'tests', order: 2, hint: 'SWC for TypeScript' },
  description: 'Jest for the API tests (health, envelope, rate limiting, auth), with Supertest',
  requiresAny: ['http-framework'],
  conflictsWith: ['testing-vitest'],
  devDependencies: ['jest', '@jest/globals', '@swc/jest', '@swc/core'],
  scripts: [
    {
      name: 'test',
      // the flag turns on Jest's ESM support: ESM tests, and under CommonJS the loading of
      // ESM-only packages such as jose (Node 24.9+); the path works on every OS
      run: 'node --experimental-vm-modules node_modules/jest/bin/jest.js',
      depth: 'wired'
    }
  ],
  filesPath: moduleFilesPath('node/testing/jest')
}

export default moduleDefinition
