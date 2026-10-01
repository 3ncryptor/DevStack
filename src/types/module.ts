import { z } from 'zod'

import type { CatalogName } from '../catalog/node'
import type { PackageJsonFragment } from './package-json'

/** An environment variable a module needs (buildPlan B10). */
export interface EnvDeclaration {
  name: string
  description: string
  example?: string
  required: boolean
  /** Never printed with a value; marked in .env.example. */
  secret?: boolean
  /** Shown in the summary when the variable is left empty (permissive defaults, D-B10). */
  warnIfUnset?: string
}

export interface ModuleCommand {
  phase: 'postInstall'
  run: readonly [binary: string, ...args: string[]]
}

/** A code fragment rendered into a framework template's slot (D-07, buildPlan B6). */
export interface SlotContribution {
  slot: string
  code: string
  /** Lower renders first; default 100. */
  order?: number
  /** Only when this module (usually a framework) is selected. */
  for?: string
}

/** Closed set of module categories (buildPlan B4, D-12); adding one is a logged decision. */
export const MODULE_CATEGORIES = [
  'language',
  'package-manager',
  'layout',
  'framework',
  'api-style',
  'database',
  'orm',
  'auth',
  'architecture',
  'env',
  'styling',
  'template',
  'testing',
  'quality',
  'middleware',
  'security',
  'devops',
  'observability',
  'api-docs',
  'repo',
  'ai',
  'misc'
] as const

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number]

export type LanguageId = 'node'

/** Module contract v2 (buildPlan B4). */
export interface DevstackModule {
  /** Stable forever, kebab-case and category-prefixed; renames go through src/modules/aliases.ts. */
  id: string
  /** Shown in prompts. */
  title: string
  description: string
  category: ModuleCategory
  language: LanguageId
  /** Capability tags this module satisfies, e.g. `http-framework`, `db:postgres`. */
  provides?: readonly string[]
  /** Catalog package names; versions come from src/catalog (D-08). */
  dependencies?: readonly CatalogName[]
  devDependencies?: readonly CatalogName[]
  requires?: string[]
  requiresAny?: string[]
  conflictsWith?: string[]
  filesPath?: string
  packageJson?: PackageJsonFragment
  /** Commands run after install, as data (buildPlan B4). `run` is a binary and its arguments. */
  commands?: readonly ModuleCommand[]
  /** Slots this module's templates render, e.g. `app.middleware`. */
  exposesSlots?: readonly string[]
  env?: readonly EnvDeclaration[]
  slots?: readonly SlotContribution[]
}

const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export const moduleDefinitionSchema = z.object({
  id: z.string().regex(MODULE_ID, 'Module ids are kebab-case, e.g. framework-express.'),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(MODULE_CATEGORIES),
  language: z.literal('node'),
  provides: z.array(z.string().min(1)).optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  requiresAny: z.array(z.string()).optional(),
  conflictsWith: z.array(z.string()).optional(),
  filesPath: z.string().optional(),
  exposesSlots: z.array(z.string()).optional(),
  env: z
    .array(
      z.object({
        name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
        description: z.string().min(1),
        example: z.string().optional(),
        required: z.boolean(),
        secret: z.boolean().optional(),
        warnIfUnset: z.string().optional()
      })
    )
    .optional(),
  slots: z
    .array(
      z.object({
        slot: z.string().min(1),
        code: z.string(),
        order: z.number().optional(),
        for: z.string().optional()
      })
    )
    .optional(),
  commands: z
    .array(z.object({ phase: z.literal('postInstall'), run: z.array(z.string()).min(1) }))
    .optional(),
  packageJson: z
    .object({
      description: z.string().optional(),
      type: z.enum(['module', 'commonjs']).optional(),
      scripts: z.record(z.string(), z.string()).optional(),
      engines: z.record(z.string(), z.string()).optional()
    })
    .optional()
})
