import type { CatalogName } from './node'

/**
 * Runtime packages whose types ship separately (buildPlan B9). When a stack depends on the runtime
 * package, the composer adds the paired @types package as a devDependency; a catalog test keeps
 * each pair on the same major.
 */
export const TYPE_PAIRS: ReadonlyArray<readonly [runtime: CatalogName, types: CatalogName]> = [
  ['express', '@types/express'],
  ['cors', '@types/cors'],
  ['morgan', '@types/morgan'],
  ['compression', '@types/compression'],
  ['pg', '@types/pg'],
  ['cookie-parser', '@types/cookie-parser']
]
