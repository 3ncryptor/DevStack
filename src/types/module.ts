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
  /**
   * Zod expression validating the value in the generated `config/env.ts`, e.g.
   * `z.coerce.number().int().positive().default(3000)`. Default: a non-empty string, optional
   * unless `required`.
   */
  schema?: string
}

export interface ModuleCommand {
  phase: 'postInstall'
  run: readonly [binary: string, ...args: string[]]
}

/** How much code is generated (D-27, D-39): `bare` is config and tooling, `wired` adds integration code. */
export type Depth = 'bare' | 'wired'

/** Evaluated against the resolved stack when planning (buildPlan B4). */
export type Condition =
  | { has: string }
  | { framework: string }
  | { option: string; equals: unknown }
  | { depth: Depth }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { not: Condition }

/** Narrows when one of a module's template files is generated, by its project-relative path. */
export interface FileRule {
  path: string
  when?: Condition
  depth?: Depth
}

/** A package.json script that depends on the stack, e.g. `db:up` only when compose has a database. */
export interface ScriptRule {
  name: string
  run: string
  when?: Condition
  depth?: Depth
}

/** A code fragment rendered into a framework template's slot (D-07, buildPlan B6). */
export interface SlotContribution {
  slot: string
  code: string
  /** Lower renders first; default 100. */
  order?: number
  /** Only when this module (usually a framework) is selected. */
  for?: string
  when?: Condition
  depth?: Depth
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

/**
 * Where a module's files, scripts and dependencies go (B8). In the single layout every target is
 * the project root (D-03); in a monorepo backend → apps/api, frontend → apps/web,
 * shared → packages/shared, and root stays at the root (tooling, workspace files).
 */
export const MODULE_TARGETS = ['root', 'backend', 'frontend', 'shared'] as const
export type ModuleTarget = (typeof MODULE_TARGETS)[number]

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
  /** Depth of this module's files, slots and env; default `wired`. Tooling modules are `bare`. */
  depth?: Depth
  /** Target the module belongs to; default `backend`. Only matters in a monorepo. */
  target?: ModuleTarget
  /** Per-file `when`/`depth` overrides for templates under `filesPath`. */
  files?: readonly FileRule[]
  /** Catalog package names; versions come from src/catalog (D-08). */
  dependencies?: readonly CatalogName[]
  devDependencies?: readonly CatalogName[]
  requires?: string[]
  requiresAny?: string[]
  conflictsWith?: string[]
  filesPath?: string
  packageJson?: PackageJsonFragment
  /**
   * Scripts added only when their condition holds; unconditional ones go in `packageJson`. A rule
   * replaces a `packageJson` script of the same name (e.g. Nest's `dev` over language-node's).
   */
  scripts?: readonly ScriptRule[]
  /** Commands run after install, as data (buildPlan B4). `run` is a binary and its arguments. */
  commands?: readonly ModuleCommand[]
  /** Slots this module's templates render, e.g. `app.middleware`. */
  exposesSlots?: readonly string[]
  env?: readonly EnvDeclaration[]
  slots?: readonly SlotContribution[]
  /** Zod schema with defaults for this module's options; templates read them as `it.options`. */
  options?: z.ZodType<Record<string, unknown>>
}

const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const depthSchema = z.enum(['bare', 'wired'])

const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ has: z.string().min(1) }),
    z.strictObject({ framework: z.string().min(1) }),
    z.strictObject({ option: z.string().min(1), equals: z.unknown() }),
    z.strictObject({ depth: depthSchema }),
    z.strictObject({ all: z.array(conditionSchema) }),
    z.strictObject({ any: z.array(conditionSchema) }),
    z.strictObject({ not: conditionSchema })
  ])
)

export const moduleDefinitionSchema = z.object({
  id: z.string().regex(MODULE_ID, 'Module ids are kebab-case, e.g. framework-express.'),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(MODULE_CATEGORIES),
  language: z.literal('node'),
  provides: z.array(z.string().min(1)).optional(),
  depth: depthSchema.optional(),
  target: z.enum(MODULE_TARGETS).optional(),
  files: z
    .array(
      z.strictObject({
        path: z.string().min(1),
        when: conditionSchema.optional(),
        depth: depthSchema.optional()
      })
    )
    .optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  requiresAny: z.array(z.string()).optional(),
  conflictsWith: z.array(z.string()).optional(),
  filesPath: z.string().optional(),
  exposesSlots: z.array(z.string()).optional(),
  options: z.custom<z.ZodType>((value) => value instanceof z.ZodType).optional(),
  env: z
    .array(
      z.object({
        name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
        description: z.string().min(1),
        example: z.string().optional(),
        required: z.boolean(),
        secret: z.boolean().optional(),
        warnIfUnset: z.string().optional(),
        schema: z.string().min(1).optional()
      })
    )
    .optional(),
  slots: z
    .array(
      z.object({
        slot: z.string().min(1),
        code: z.string(),
        order: z.number().optional(),
        for: z.string().optional(),
        when: conditionSchema.optional(),
        depth: depthSchema.optional()
      })
    )
    .optional(),
  scripts: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        run: z.string().min(1),
        when: conditionSchema.optional(),
        depth: depthSchema.optional()
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
      engines: z.record(z.string(), z.string()).optional(),
      exports: z.record(z.string(), z.string()).optional()
    })
    .optional()
})
