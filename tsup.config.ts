import { defineConfig } from 'tsup'

// Bundles the CLI into dist/cli.js (ESM). Module templates are not bundled: they ship as-is
// from src/modules/*/files and are resolved at runtime from the package root (src/paths.ts).
export default defineConfig({
  entry: { cli: 'bin/cli.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  splitting: false,
  sourcemap: false
})
