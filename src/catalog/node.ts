/**
 * Version catalog for generated Node projects (buildPlan B9, D-08). Modules reference packages by
 * name only; every version a generated project installs comes from here. Verified against the
 * npm registry on 2026-09-30.
 *
 * Nest stays on 11 and Prisma on 6 while generated projects are CommonJS: Nest 12 is ESM-only and
 * Prisma 7 is ESM-first. Both move with the ESM switch in task 0.3 (D-53).
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

  // HTTP frameworks
  express: { version: '^5.2.1' },
  '@types/express': { version: '^5.0.6' },
  '@nestjs/common': { version: '^11.2.6' },
  '@nestjs/core': { version: '^11.2.6' },
  '@nestjs/platform-express': { version: '^11.2.6' },
  'reflect-metadata': { version: '^0.2.2' },
  rxjs: { version: '^7.8.2' },
  '@swc-node/register': { version: '^1.12.1' },
  '@swc/core': { version: '^1.16.12', allowBuilds: ['@swc/core'] },

  // data
  prisma: { version: '^6.19.3', allowBuilds: ['prisma', '@prisma/engines'] },
  '@prisma/client': { version: '^6.19.3', allowBuilds: ['@prisma/client'] },

  // middleware and security
  cors: { version: '^2.8.6' },
  '@types/cors': { version: '^2.8.19' },
  helmet: { version: '^8.3.0' },
  'express-rate-limit': { version: '^8.7.0' },
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
