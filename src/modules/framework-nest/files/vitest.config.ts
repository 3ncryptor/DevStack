import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC keeps the decorator metadata Nest's dependency injection reads
export default defineConfig({
  plugins: [swc.vite()],
  test: { include: ['tests/**/*.test.ts'] }
})
