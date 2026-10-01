/**
 * Version catalog for generated Node projects (buildPlan B9, D-08). Modules reference packages by
 * name only; every version a generated project installs comes from here. Verified against the
 * npm registry on 2026-09-30 (backend baseline packages on 2026-10-01).
 *
 * Generated projects are ESM, which Nest 12 (ESM-only) and Prisma 7 (ESM-first) require (D-53).
 */
export interface CatalogEntry {
  version: string
  /**
   * Packages (this one and/or its transitive dependencies) whose install scripts must run.
   * pnpm >= 11 refuses to install until they are approved.
   */
  allowBuilds?: readonly string[]
}

export const NODE_CATALOG = {
  // runtime and language
  '@types/node': { version: '^24.19.0' },
  typescript: { version: '~6.0.3' }, // typescript-eslint supports < 6.1
  tsx: { version: '^4.23.15', allowBuilds: ['esbuild'] },
  turbo: { version: '^2.11.6' },

  // HTTP frameworks
  express: { version: '^5.2.1' },
  '@types/express': { version: '^5.0.6' },
  '@nestjs/common': { version: '^12.1.2' },
  '@nestjs/core': { version: '^12.1.2' },
  '@nestjs/platform-express': { version: '^12.1.2' },
  'reflect-metadata': { version: '^0.2.2' },
  rxjs: { version: '^7.8.2' },
  '@swc-node/register': { version: '^1.12.1' },
  '@swc/core': { version: '^1.16.12', allowBuilds: ['@swc/core'] },

  // web (Next.js 16 pairs with React 19.2, as create-next-app 16.3.8 pins)
  next: { version: '^16.3.8' },
  react: { version: '^19.2.8' },
  'react-dom': { version: '^19.2.8' },
  '@types/react': { version: '^19.2.0' },
  '@types/react-dom': { version: '^19.2.0' },
  tailwindcss: { version: '^4.3.3' },
  '@tailwindcss/postcss': { version: '^4.3.3' },
  postcss: { version: '^8.5.28' },

  // data
  prisma: { version: '^7.10.0', allowBuilds: ['prisma', '@prisma/engines'] },
  '@prisma/client': { version: '^7.10.0', allowBuilds: ['@prisma/client'] },
  '@prisma/adapter-pg': { version: '^7.10.0' },
  pg: { version: '^8.23.0' },
  '@types/pg': { version: '^8.23.1' },
  dotenv: { version: '^18.0.4' },

  // backend baseline (B17.2)
  pino: { version: '^10.3.1' },
  zod: { version: '^4.6.5' },
  supertest: { version: '^7.3.0' },
  '@types/supertest': { version: '^7.2.1' },

  // middleware and security
  cors: { version: '^2.8.6' },
  '@types/cors': { version: '^2.8.19' },
  helmet: { version: '^8.3.0' },
  morgan: { version: '^1.12.1' },
  '@types/morgan': { version: '^1.9.10' },
  compression: { version: '^1.8.2' },
  '@types/compression': { version: '^1.8.1' },

  // quality
  eslint: { version: '^10.11.0' },
  '@eslint/js': { version: '^10.0.1' },
  'typescript-eslint': { version: '^8.71.0' },
  'eslint-config-prettier': { version: '^10.1.8' },
  globals: { version: '^17.12.0' },
  prettier: { version: '^3.9.9' },
  husky: { version: '^9.1.7' },
  'lint-staged': { version: '^17.6.0' },
  '@commitlint/cli': { version: '^21.2.3' },
  '@commitlint/config-conventional': { version: '^21.2.3' }
} as const satisfies Record<string, CatalogEntry>

export type CatalogName = keyof typeof NODE_CATALOG

export function isCatalogName(name: string): name is CatalogName {
  return Object.hasOwn(NODE_CATALOG, name)
}

/** Sorted, de-duplicated list of packages whose install scripts must be approved. */
export function buildApprovalsFor(names: readonly string[]): string[] {
  const approvals = names.flatMap((name) => {
    const entry: CatalogEntry | undefined = isCatalogName(name) ? NODE_CATALOG[name] : undefined
    return entry?.allowBuilds ?? []
  })
  return [...new Set(approvals)].sort()
}
