import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // planning formats every file with Prettier; a busy CI runner must not fail on time alone
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/modules/**/files/**'],
      reporter: ['text-summary', 'text']
    }
  }
})
