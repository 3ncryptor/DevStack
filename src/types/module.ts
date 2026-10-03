import { z } from 'zod'

import type { CatalogName } from '../catalog/node'
import { databaseTraitsSchema, type DatabaseTraits } from './database'
import type { PackageJsonFragment } from './package-json'

// modules import their contract from this file alone (module contract lint)
export type { DatabaseTraits } from './database'

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
   * `secret`: the local `.env` gets a random value generated at plan time (B17.7), for secrets
   * used purely locally such as `JWT_SECRET`. `.env.example` stays blank.
   */
  generate?: 'secret'
  /** Only when this holds, e.g. an OAuth provider's credentials when it is selected. */
  when?: Condition
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
/** How the generated backend's code is loaded (task 5.2): ESM by default, or CommonJS. */
export type ModuleSystem = 'esm' | 'cjs'

export type Condition =
  | { has: string }
  /** The project's module system, e.g. Nest's dev script differs under CommonJS. */
  | { moduleSystem: ModuleSystem }
  /** The API's framework, e.g. `framework-nest`; a fullstack stack's web framework never matches. */
  | { framework: string }
  | { option: string; equals: unknown }
  | { depth: Depth }
  /** The target being rendered, e.g. `admin` (files only: slots and scripts never match it). */
  | { target: ModuleTarget }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { not: Condition }

/**
 * A catalog package, or one that is installed only when a condition holds, e.g. `@fastify/cors`
 * only with Fastify (M4): `{ name: '@fastify/cors', when: { has: 'framework-fastify' } }`.
 */
export type DependencyEntry = CatalogName | { name: CatalogName; when: Condition }

/** The package name of a dependency entry. */
export const dependencyName = (entry: DependencyEntry): CatalogName =>
  typeof entry === 'string' ? entry : entry.name

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
  'cache',
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
export const MODULE_TARGETS = ['root', 'backend', 'frontend', 'admin', 'shared'] as const
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
  dependencies?: readonly DependencyEntry[]
  devDependencies?: readonly DependencyEntry[]
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
  /** A database module's description for ORMs and Docker (D-96). */
  database?: DatabaseTraits
  /** VS Code extensions recommended with this module, e.g. `prisma.prisma`. */
  vscodeExtensions?: readonly string[]
  /** What AGENTS.md tells an AI assistant about this module (D-96). */
  agentsMd?: AgentsMdNotes
  /** Where the guided wizard offers this module (D-96). */
  wizard?: WizardChoice
}

/** Wizard questions whose choices are modules (D-96); each module says where it is offered. */
export const WIZARD_QUESTIONS = [
  'framework',
  'frontend',
  'styling',
  'frontendArchitecture',
  'database',
  'orm',
  'auth',
  'logger',
  'template',
  'architecture',
  'tests',
  'appSetup',
  'repoExtras'
] as const
export type WizardQuestion = (typeof WIZARD_QUESTIONS)[number]

/** A module as a wizard choice: where, in which order, and how it reads if not by its title. */
export interface WizardChoice {
  question: WizardQuestion
  order: number
  label?: string
  hint?: string
  /** Pre-selected in a multi-select question. */
  checked?: boolean
}

/** Lines a module adds to AGENTS.md; `{{api}}` in a layout line is the API's folder prefix. */
export interface AgentsMdNotes {
  layout?: readonly string[]
  conventions?: readonly string[]
  /** Step 2 of "Adding a feature": how to store the feature's data. */
  storage?: string
}

const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const depthSchema = z.enum(['bare', 'wired'])

const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ has: z.string().min(1) }),
    z.strictObject({ framework: z.string().min(1) }),
    z.strictObject({ moduleSystem: z.enum(['esm', 'cjs']) }),
    z.strictObject({ option: z.string().min(1), equals: z.unknown() }),
    z.strictObject({ depth: depthSchema }),
    z.strictObject({ target: z.enum(MODULE_TARGETS) }),
    z.strictObject({ all: z.array(conditionSchema) }),
    z.strictObject({ any: z.array(conditionSchema) }),
    z.strictObject({ not: conditionSchema })
  ])
)

function dependencyEntrySchema() {
  return z.union([z.string(), z.strictObject({ name: z.string(), when: conditionSchema })])
}

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
  dependencies: z.array(dependencyEntrySchema()).optional(),
  devDependencies: z.array(dependencyEntrySchema()).optional(),
  requires: z.array(z.string()).optional(),
  requiresAny: z.array(z.string()).optional(),
  conflictsWith: z.array(z.string()).optional(),
  filesPath: z.string().optional(),
  exposesSlots: z.array(z.string()).optional(),
  options: z.custom<z.ZodType>((value) => value instanceof z.ZodType).optional(),
  database: databaseTraitsSchema.optional(),
  vscodeExtensions: z.array(z.string().min(1)).optional(),
  wizard: z
    .strictObject({
      question: z.enum(WIZARD_QUESTIONS),
      order: z.number(),
      label: z.string().min(1).optional(),
      hint: z.string().min(1).optional(),
      checked: z.boolean().optional()
    })
    .optional(),
  agentsMd: z
    .strictObject({
      layout: z.array(z.string().min(1)).optional(),
      conventions: z.array(z.string().min(1)).optional(),
      storage: z.string().min(1).optional()
    })
    .optional(),
  env: z
    .array(
      z.object({
        name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
        description: z.string().min(1),
        example: z.string().optional(),
        required: z.boolean(),
        secret: z.boolean().optional(),
        warnIfUnset: z.string().optional(),
        generate: z.literal('secret').optional(),
        when: conditionSchema.optional(),
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
