import { builtinModules } from 'node:module'
import path from 'node:path'

import { InputError } from '../errors'

const MAX_NAME_LENGTH = 214
const RESERVED_NAMES = new Set(['node_modules', 'favicon.ico'])
/** Folder names Windows cannot use. */
const WINDOWS_DEVICE_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/
const CORE_MODULES = new Set(builtinModules.map((name) => name.replace(/^node:/, '')))
/** npm rejects these in new package names even though they are URL-safe. */
const SPECIAL_CHARACTERS = /[~'!()*]/
const SCOPED_NAME = /^@([^/]+)\/([^/]+)$/

function partProblem(part: string): string | undefined {
  if (part.length === 0) return 'must not be empty'
  if (part.startsWith('.')) return 'must not start with a dot'
  if (part.startsWith('_')) return 'must not start with an underscore'
  if (part !== part.toLowerCase()) return 'must be lowercase'
  if (part.trim() !== part || part.includes(' ')) return 'must not contain spaces'
  if (SPECIAL_CHARACTERS.test(part)) return "must not contain ~ ' ! ( ) or *"
  if (encodeURIComponent(part) !== part) return 'must only contain URL-safe characters'
  return undefined
}

/**
 * Validates a project name against npm's rules for new packages. Returns a message describing
 * the problem, or undefined when the name is valid. A valid name is always a single path segment,
 * so it can never point outside the working directory.
 */
export function projectNameProblem(name: string): string | undefined {
  if (name.length > MAX_NAME_LENGTH) {
    return `Project name must be at most ${MAX_NAME_LENGTH} characters.`
  }
  const scoped = SCOPED_NAME.exec(name)
  const parts = scoped ? [scoped[1] ?? '', scoped[2] ?? ''] : [name]
  if (!scoped && name.includes('/')) {
    return 'Project name must not contain "/" (use @scope/name for a scoped package).'
  }
  for (const part of parts) {
    const problem = partProblem(part)
    if (problem !== undefined) {
      return `Project name ${problem}: "${name}".`
    }
  }
  // the folder name is checked even for scoped names: @x/node_modules would land in ./node_modules
  const folder = parts[parts.length - 1] ?? ''
  if (RESERVED_NAMES.has(folder) || WINDOWS_DEVICE_NAMES.test(folder)) {
    return `"${name}" uses a reserved folder name. Choose another name.`
  }
  if (!scoped && CORE_MODULES.has(folder)) {
    return `"${name}" is a Node core module name. Choose another name.`
  }
  return undefined
}

export function assertValidProjectName(name: string): string {
  const problem = projectNameProblem(name)
  if (problem !== undefined) {
    throw new InputError(problem)
  }
  return name
}

/** Folder name for a project: the package part of a scoped name. */
export function projectDirectoryName(name: string): string {
  return SCOPED_NAME.exec(name)?.[2] ?? name
}

/** Resolves `relative` against `baseDir`, refusing any result outside `baseDir`. */
export function resolveInside(baseDir: string, relative: string): string {
  const base = path.resolve(baseDir)
  const resolved = path.resolve(base, relative)
  const fromBase = path.relative(base, resolved)
  const escapes = fromBase === '..' || fromBase.startsWith(`..${path.sep}`)
  const inside = !escapes && !path.isAbsolute(fromBase)
  if (path.isAbsolute(relative) || !inside) {
    throw new InputError(`Refusing to write "${relative}": it is outside ${base}.`)
  }
  return resolved
}
