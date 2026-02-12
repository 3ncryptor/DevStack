export type DependencyMap = Record<string, string>

export interface PackageJson {
  name: string
  version: string
  private: boolean
  description?: string
  scripts?: Record<string, string>
  dependencies?: DependencyMap
  devDependencies?: DependencyMap
  engines?: Record<string, string>
}

export type PackageJsonFragment = Partial<Omit<PackageJson, 'name' | 'version' | 'private'>>
