import { z } from 'zod'

import { InputError } from '../errors'

/**
 * Project settings (buildPlan A6 layer 2, tasks 5.1-5.3): how the generated code looks and what
 * the project is called, independent of which modules are in the stack. Every source (remembered
 * defaults, a stack config, a preset) gives a partial set; `resolveSettings` fills the rest, and
 * the manifest records the resolved values so `add` and `remove` re-plan the same files.
 */

export const LICENSES = ['UNLICENSED', 'MIT', 'Apache-2.0', 'ISC'] as const
export type License = (typeof LICENSES)[number]

export const STRICTNESS = ['standard', 'strictest'] as const
export type Strictness = (typeof STRICTNESS)[number]

const MIN_PORT = 1024
const MAX_PORT = 65_535

const appName = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]{0,30}$/,
    'Use lowercase letters, digits and dashes, starting with a letter'
  )
  // packages/shared is the shared package; an app of that name would read like it
  .refine((name) => name !== 'shared', 'shared is the name of the shared package')

const port = z.number().int().min(MIN_PORT).max(MAX_PORT)

export const styleSchema = z.strictObject({
  semi: z.boolean(),
  singleQuote: z.boolean(),
  trailingComma: z.enum(['none', 'es5', 'all']),
  printWidth: z.number().int().min(40).max(200),
  tabWidth: z.number().int().min(1).max(8),
  useTabs: z.boolean()
})

const appsSchema = z.strictObject({ backend: appName, frontend: appName, admin: appName })
const portsSchema = z.strictObject({ backend: port, frontend: port, admin: port })

/** Settings as a source gives them: every field optional. */
export const settingsSchema = z.strictObject({
  style: styleSchema.partial().optional(),
  strictness: z.enum(STRICTNESS).optional(),
  apps: appsSchema.partial().optional(),
  ports: portsSchema.partial().optional(),
  license: z.enum(LICENSES).optional(),
  author: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  initialCommit: z.boolean().optional()
})

export type ProjectSettings = z.infer<typeof settingsSchema>
export type CodeStyle = z.infer<typeof styleSchema>

export interface ResolvedSettings {
  style: CodeStyle
  strictness: Strictness
  /** Folder names under apps/ in a monorepo. */
  apps: z.infer<typeof appsSchema>
  /** Ports chosen explicitly; the rest follow the layout (D-30: 3000, or api 3001 in a monorepo). */
  ports: Partial<z.infer<typeof portsSchema>>
  license: License
  author?: string
  description?: string
  initialCommit: boolean
}

/** The defaults: the style the templates are written in. */
export const DEFAULT_SETTINGS: ResolvedSettings = {
  style: {
    semi: false,
    singleQuote: true,
    trailingComma: 'none',
    printWidth: 100,
    tabWidth: 2,
    useTabs: false
  },
  strictness: 'standard',
  apps: { backend: 'api', frontend: 'web', admin: 'admin' },
  ports: {},
  license: 'UNLICENSED',
  initialCommit: true
}

const SCALARS = ['strictness', 'license', 'author', 'description', 'initialCommit'] as const

/** Merges partial settings without filling defaults; later sources win, field by field. */
export function mergeSettings(
  ...sources: ReadonlyArray<ProjectSettings | undefined>
): ProjectSettings {
  return sources.reduce<ProjectSettings>((merged, source) => {
    if (source === undefined) return merged
    const nested = (key: 'style' | 'apps' | 'ports') =>
      merged[key] === undefined && source[key] === undefined
        ? {}
        : { [key]: { ...merged[key], ...source[key] } }
    return { ...merged, ...source, ...nested('style'), ...nested('apps'), ...nested('ports') }
  }, {})
}

/** Merges partial settings over the defaults; later sources win, field by field. */
export function resolveSettings(
  ...sources: ReadonlyArray<ProjectSettings | undefined>
): ResolvedSettings {
  const merged = sources.reduce<ResolvedSettings>((resolved, source) => {
    if (source === undefined) return resolved
    const scalars = Object.fromEntries(
      SCALARS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])
    )
    return {
      ...resolved,
      ...scalars,
      style: { ...resolved.style, ...source.style },
      apps: { ...resolved.apps, ...source.apps },
      ports: { ...resolved.ports, ...source.ports }
    }
  }, DEFAULT_SETTINGS)
  assertDistinct('App folder names', Object.values(merged.apps))
  return merged
}

/** An app's folder in a monorepo: apps/<name> (B8, task 5.3). */
export const appDir = (
  settings: ResolvedSettings,
  role: 'backend' | 'frontend' | 'admin'
): string => `apps/${settings.apps[role]}`

/** Port of an app: the chosen one, or the layout's default (D-30). */
export function portFor(
  settings: ResolvedSettings,
  role: 'backend' | 'frontend' | 'admin',
  monorepo: boolean
): number {
  const chosen = settings.ports[role]
  if (chosen !== undefined) return chosen
  if (!monorepo) return SINGLE_APP_PORT
  return MONOREPO_PORTS[role]
}

/** D-30: a single app serves on 3000; in a monorepo web 3000, api 3001, admin 3002. */
export const SINGLE_APP_PORT = 3000
export const MONOREPO_PORTS = { backend: 3001, frontend: 3000, admin: 3002 } as const

/** Every resolved value, ports included, so a replay of the manifest is exact. */
export function settingsForManifest(
  settings: ResolvedSettings,
  monorepo: boolean
): ProjectSettings {
  const roles = monorepo ? (['backend', 'frontend', 'admin'] as const) : (['backend'] as const)
  const ports = Object.fromEntries(roles.map((role) => [role, portFor(settings, role, monorepo)]))
  return { ...settings, ports }
}

/** Ports must differ once the layout defaults are filled in. */
export function assertDistinctPorts(settings: ResolvedSettings, monorepo: boolean): void {
  if (!monorepo) return
  assertDistinct(
    'Ports',
    (['backend', 'frontend', 'admin'] as const).map((role) => portFor(settings, role, true))
  )
}

function assertDistinct(what: string, values: ReadonlyArray<string | number>): void {
  const duplicate = values.find((value, index) => values.indexOf(value) !== index)
  if (duplicate !== undefined) {
    throw new InputError(`${what} must differ; ${String(duplicate)} is used twice.`)
  }
}
