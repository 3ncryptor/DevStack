/**
 * Jest in native ESM mode (the project is ESM): TypeScript compiled by SWC, `.js` import
 * specifiers mapped back to the `.ts` sources, decorator metadata kept for NestJS.
 */
export default {
  testEnvironment: 'node',
  // Jest's own file crawler: a test run never starts a background Watchman daemon
  watchman: false,
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2023',
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true }
        }
      }
    ]
  }
}
