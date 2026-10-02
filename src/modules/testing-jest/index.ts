import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

/**
 * Jest for the API tests (M4, D-75): the same generated tests as Vitest and node:test, with
 * `test` from @jest/globals. The project is ESM, so Jest runs in its native ESM mode, and SWC
 * compiles TypeScript (with decorator metadata, which Nest needs).
 */
const moduleDefinition: DevstackModule = {
  id: 'testing-jest',
  title: 'Jest',
  category: 'testing',
  language: 'node',
  description: 'Jest for the API tests (health, envelope, rate limiting, auth), with Supertest',
  requiresAny: ['http-framework'],
  conflictsWith: ['testing-vitest'],
  devDependencies: ['jest', '@jest/globals', '@swc/jest', '@swc/core'],
  scripts: [
    {
      name: 'test',
      // the flag is what turns on Jest's ESM support; the path works on every OS
      run: 'node --experimental-vm-modules node_modules/jest/bin/jest.js',
      depth: 'wired'
    }
  ],
  filesPath: moduleFilesPath('testing-jest')
}

export default moduleDefinition
