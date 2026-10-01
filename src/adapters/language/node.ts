import { PACKAGE_MANAGERS, type PackageManagerId } from '../package-manager/index'

/**
 * The Node/TypeScript language adapter (buildPlan B7). It holds only what callers need today;
 * the interface grows when a second language needs a method (D-21).
 */
export interface LanguageAdapter {
  id: 'node'
  manifestFileName: string
  defaultPackageManager: PackageManagerId
  packageManagers: readonly PackageManagerId[]
  /** Base image for generated Dockerfiles; follows the generated engines (D-09). */
  dockerBaseImage: string
}

export const NODE_LANGUAGE: LanguageAdapter = {
  id: 'node',
  manifestFileName: 'package.json',
  defaultPackageManager: 'npm',
  packageManagers: PACKAGE_MANAGERS,
  dockerBaseImage: 'node:24-alpine'
}
