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
  // Fastify 5 and its plugins for that major (M4); verified 2026-10-02
  fastify: { version: '^5.12.5' },
  '@fastify/cors': { version: '^11.3.0' },
  '@fastify/helmet': { version: '^13.1.1' },
  '@fastify/compress': { version: '^9.2.0' },
  '@fastify/cookie': { version: '^11.1.2' },
  '@scalar/fastify-api-reference': { version: '^1.72.4' },
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
  // React + Vite (M4, D-79); verified 2026-10-02
  'react-router': { version: '^8.4.0' },
  '@vitejs/plugin-react': { version: '^6.1.1' },

  // data
  prisma: { version: '^7.10.0', allowBuilds: ['prisma', '@prisma/engines'] },
  '@prisma/client': { version: '^7.10.0', allowBuilds: ['@prisma/client'] },
  '@prisma/adapter-pg': { version: '^7.10.0' },
  '@prisma/adapter-mariadb': { version: '^7.10.0' },
  '@prisma/adapter-better-sqlite3': { version: '^7.10.0' },
  pg: { version: '^8.23.0' },
  '@types/pg': { version: '^8.23.1' },
  // databases and ORMs beyond Postgres + Prisma (M4, D-77); verified 2026-10-02
  mysql2: { version: '^3.24.5' },
  // ships prebuilt binaries (glibc, musl, macOS, Windows), no install script
  'better-sqlite3': { version: '^13.0.3' },
  '@types/better-sqlite3': { version: '^9.6.0' },
  'drizzle-orm': { version: '^0.45.3' },
  'drizzle-kit': { version: '^0.31.11', allowBuilds: ['esbuild'] },
  mongoose: { version: '^9.10.3' },
  redis: { version: '^6.3.0' },
  dotenv: { version: '^18.0.4' },

  // backend baseline (B17.2)
  pino: { version: '^10.3.1' },
  // dev scripts only: readable logs while developing (task 4.3); verified 2026-10-03
  'pino-pretty': { version: '^13.1.3' },
  winston: { version: '^3.19.0' },
  zod: { version: '^4.6.5' },
  supertest: { version: '^7.3.0' },
  vitest: { version: '^5.0.3' },
  // vitest's peer; yarn classic does not install peers on its own
  vite: { version: '^8.3.2' },
  'unplugin-swc': { version: '^2.0.0' },
  // Jest 30 with SWC for TypeScript and native ESM (M4, D-75); verified 2026-10-02
  jest: { version: '^30.5.2' },
  '@jest/globals': { version: '^30.5.2' },
  '@swc/jest': { version: '^0.2.39' },
  secretlint: { version: '^13.0.6' },
  '@secretlint/secretlint-rule-preset-recommend': { version: '^13.0.6' },
  '@types/supertest': { version: '^7.2.1' },

  // middleware and security
  cors: { version: '^2.8.6' },
  '@types/cors': { version: '^2.8.19' },
  helmet: { version: '^8.3.0' },
  '@scalar/express-api-reference': { version: '^0.10.25' },
  morgan: { version: '^1.12.1' },
  '@types/morgan': { version: '^1.9.10' },
  compression: { version: '^1.8.2' },
  '@types/compression': { version: '^1.8.1' },

  // auth (D-06: password hashing is a catalog dependency, not a module); verified 2026-10-01
  argon2: { version: '^0.45.1', allowBuilds: ['argon2'] },
  jose: { version: '^6.2.12' },
  'cookie-parser': { version: '^1.4.7' },
  '@types/cookie-parser': { version: '^1.4.10' },
  // D-38, D-69: ESM-only, no native code; verified 2026-10-02
  'better-auth': { version: '^1.7.7' },

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
