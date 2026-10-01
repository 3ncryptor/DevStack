export type DependencyMap = Record<string, string>

export interface PackageJson {
  name: string
  version: string
  private: boolean
  type?: 'module' | 'commonjs'
  description?: string
  scripts?: Record<string, string>
  dependencies?: DependencyMap
  devDependencies?: DependencyMap
  engines?: Record<string, string>
  /** `<manager>@<version>`; Turborepo and corepack read it (monorepo root). */
  packageManager?: string
  /** npm, yarn and bun workspaces (pnpm reads pnpm-workspace.yaml). */
  workspaces?: string[]
  /** Entry points, e.g. a workspace package that ships TypeScript source. */
  exports?: Record<string, string>
  /** DevStack settings, e.g. the monorepo ports (D-30). */
  devstack?: { ports: Record<string, number> }
}

/** Module fragments cannot declare dependencies: versions come only from the catalog (D-08). */
export type PackageJsonFragment = Partial<
  Omit<
    PackageJson,
    | 'name'
    | 'version'
    | 'private'
    | 'dependencies'
    | 'devDependencies'
    | 'packageManager'
    | 'workspaces'
    | 'devstack'
  >
>
