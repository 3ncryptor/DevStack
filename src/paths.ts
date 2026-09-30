import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Nearest directory above `startDir` that contains a package.json. From source
 * (src/paths.ts) and from the bundle (dist/cli.js) this is the package root, so the
 * templates shipped in src/modules/<id>/files resolve the same way in dev and when published.
 */
function findPackageRoot(startDir: string): string {
  let directory = startDir
  for (;;) {
    if (existsSync(path.join(directory, 'package.json'))) {
      return directory
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error(`Could not locate package.json above ${startDir}`)
    }
    directory = parent
  }
}

export const PACKAGE_ROOT = findPackageRoot(import.meta.dirname)

export function moduleFilesPath(moduleId: string): string {
  return path.join(PACKAGE_ROOT, 'src', 'modules', moduleId, 'files')
}
