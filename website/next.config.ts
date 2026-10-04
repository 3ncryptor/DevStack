import path from 'node:path'

import type { NextConfig } from 'next'

// the site imports DevStack's own resolver and wizard from ../src (D-99), so the repository
// root is the root Turbopack resolves and traces from
const repositoryRoot = path.join(process.cwd(), '..')

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot
}

export default nextConfig
