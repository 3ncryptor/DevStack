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
}

/** Module fragments cannot declare dependencies: versions come only from the catalog (D-08). */
export type PackageJsonFragment = Partial<
  Omit<PackageJson, 'name' | 'version' | 'private' | 'dependencies' | 'devDependencies'>
>
