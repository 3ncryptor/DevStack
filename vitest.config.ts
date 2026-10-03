import os from 'node:os'
import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // never read the developer's remembered defaults or presets (task 5.4): a folder that
    // does not exist reads as "nothing remembered"
    env: { DEVSTACK_CONFIG_HOME: path.join(os.tmpdir(), `devstack-test-home-${process.pid}`) },
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
