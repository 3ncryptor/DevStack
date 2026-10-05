import type { PackageManagerId } from '../adapters/package-manager/index'
import { InputError } from '../errors'
import type { Depth, ModuleSystem } from '../types/module'

export type ModuleOptions = Record<string, Record<string, unknown>>

/** A stack as the website's builder describes it (D-99). */
export interface StackSelection {
  projectName: string
  modules: readonly string[]
  moduleOptions?: Readonly<ModuleOptions>
  packageManager?: PackageManagerId
  depth?: Depth
  moduleSystem?: ModuleSystem
}

/** Where the command is pasted: a POSIX shell (macOS, Linux, WSL) or Windows PowerShell. */
export type Shell = 'posix' | 'powershell'

interface ShellRules {
  /** npx itself: PowerShell runs npx.ps1 first, which the default Windows script policy blocks. */
  program: string
  /** Words made only of these characters need no quotes. */
  safe: RegExp
  quote: (word: string) => string
}

export const SHELLS: Readonly<Record<Shell, ShellRules>> = {
  posix: {
    program: 'npx',
    safe: /^[\w@%+=:,./-]+$/,
    quote: (word) => `'${word.replaceAll("'", `'\\''`)}'`
  },
  // a bare comma list is an array in PowerShell (a,b → "a b"), and @ starts a splat
  powershell: {
    program: 'npx.cmd',
    safe: /^[\w%+=:./-]+$/,
    quote: (word) => `'${word.replaceAll("'", "''")}'`
  }
}

const optionValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

/**
 * The one command that generates `selection` (D-99): what the stack builder offers to copy.
 * `--yes` because the builder already was the review.
 */
export function commandFor(
  selection: StackSelection,
  packageName: string,
  shell: Shell = 'posix'
): string {
  const rules = SHELLS[shell]
  const options = Object.entries(selection.moduleOptions ?? {}).flatMap(([id, values]) =>
    Object.entries(values).map(([key, value]) => ['--option', `${id}.${key}=${optionValue(value)}`])
  )
  const words = [
    packageName,
    selection.projectName,
    '--modules',
    selection.modules.join(','),
    ...options.flat(),
    ...(selection.packageManager === undefined ? [] : ['--pm', selection.packageManager]),
    ...(selection.depth === undefined ? [] : ['--depth', selection.depth]),
    ...(selection.moduleSystem === undefined ? [] : ['--module-system', selection.moduleSystem]),
    '--yes'
  ]
  const quoted = words.map((word) => (rules.safe.test(word) ? word : rules.quote(word)))
  return [rules.program, ...quoted].join(' ')
}

/** `--modules a,b,c` → `['a', 'b', 'c']`. */
export function parseModulesFlag(value: string): string[] {
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
  if (ids.length === 0) throw new InputError('--modules needs at least one module id.')
  return ids
}

const parseValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

/** `--option security-rate-limit.algorithm=token-bucket`, repeated → options per module. */
export function parseModuleOptions(values: readonly string[]): ModuleOptions {
  const options: ModuleOptions = {}
  for (const value of values) {
    const match = /^([a-z][a-z0-9-]*)\.([A-Za-z]\w*)=(.*)$/s.exec(value)
    if (match === null) {
      throw new InputError(`--option "${value}": use <module>.<option>=<value>.`)
    }
    const [, id = '', key = '', raw = ''] = match
    options[id] = { ...options[id], [key]: parseValue(raw) }
  }
  return options
}
