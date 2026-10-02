import { PACKAGE_MANAGERS, type PackageManagerId } from '../../adapters/package-manager/index'
import type { Choice, Prompter } from '../../intake/prompter'
import type { DevstackModule } from '../../types/module'
import { previewNote } from './folder-previews'

/**
 * The wizard's questions as data, in the A0.2 order (D-34), limited to the modules that exist
 * today. Each step says when it applies, which modules its answer adds and how the review
 * screen shows it, so "Edit an answer" can re-ask one step and the rest follows.
 */

type Registry = ReadonlyMap<string, DevstackModule>

export interface WizardAnswers {
  appType?: string
  framework?: string
  frontend?: string
  styling?: string
  admin?: boolean
  frontendArchitecture?: string
  database?: string
  orm?: string
  redis?: boolean
  auth?: string
  oauthProviders?: string[]
  template?: string
  logger?: string
  packageManager?: PackageManagerId
  architecture?: string
  preCommit?: boolean
  docker?: boolean
  appSetup?: string[]
  repoExtras?: string[]
  rateLimitAlgorithm?: string
  tests?: string
  apiVersioning?: boolean
  apiDocs?: boolean
  ci?: boolean
  asyncHandler?: boolean
}

export interface StepEnvironment {
  registry: Registry
  defaultPackageManager: PackageManagerId
  /** Set by --pm or a config; the package manager question is then skipped. */
  fixedPackageManager?: PackageManagerId
  /** From the pre-flight; managers missing here are marked "not installed". */
  installedPackageManagers?: ReadonlySet<PackageManagerId>
}

export interface WizardStep {
  key: keyof WizardAnswers
  /** Name on the review screen and in the "Edit an answer" menu. */
  label: string
  applies: (answers: WizardAnswers, environment: StepEnvironment) => boolean
  /** A select step's compatible options; with exactly one, it is taken without asking. */
  options?: (answers: WizardAnswers, environment: StepEnvironment) => Choice<string>[]
  ask: (
    prompter: Prompter,
    answers: WizardAnswers,
    environment: StepEnvironment
  ) => Promise<WizardAnswers>
  describe: (answers: WizardAnswers, environment: StepEnvironment) => string
  modules: (answers: WizardAnswers) => string[]
  /** Module options this answer sets, e.g. the rate-limit algorithm. */
  moduleOptions?: (answers: WizardAnswers) => Record<string, Record<string, unknown>>
}

/** Always configured, never asked (D-35). */
export const ALWAYS_INCLUDED = ['language-node', 'quality-eslint', 'quality-prettier']
export const ALWAYS_INCLUDED_LABEL = 'TypeScript, ESLint, Prettier'

const NONE = 'none'

const FULLSTACK = 'fullstack'

const APP_TYPES: Choice<string>[] = [
  { value: 'backend', label: 'Backend' },
  { value: FULLSTACK, label: 'Fullstack', hint: 'API + Next.js web app in a monorepo' }
]
const FRONTENDS: Choice<string>[] = [{ value: 'framework-nextjs', label: 'Next.js' }]
const STYLINGS: Choice<string>[] = [
  { value: 'ui-tailwind', label: 'Tailwind CSS' },
  { value: 'none', label: 'Plain CSS' }
]
const FRAMEWORKS: Choice<string>[] = [
  { value: 'framework-express', label: 'Express' },
  { value: 'framework-fastify', label: 'Fastify' },
  { value: 'framework-nest', label: 'NestJS' }
]
/** Questions 5 and 6 (M4, D-77): SQL databases take Prisma or Drizzle, MongoDB takes Mongoose. */
const DATABASES: Choice<string>[] = [
  { value: 'database-postgres', label: 'PostgreSQL' },
  { value: 'database-mysql', label: 'MySQL' },
  { value: 'database-sqlite', label: 'SQLite', hint: 'a local file, no server' },
  { value: 'database-mongodb', label: 'MongoDB' },
  { value: NONE, label: 'None' }
]
const ORMS: Choice<string>[] = [
  { value: 'orm-prisma', label: 'Prisma' },
  { value: 'orm-drizzle', label: 'Drizzle' },
  { value: 'orm-mongoose', label: 'Mongoose' }
]
const MONGODB = 'database-mongodb'
/** Question 7: auth needs a database; Better Auth and sessions follow (M3, M4). */
const AUTHS: Choice<string>[] = [
  { value: NONE, label: 'None' },
  {
    value: 'auth-jwt',
    label: 'Email + password (JWT)',
    hint: 'httpOnly cookies, rotating refresh tokens, admin role'
  },
  {
    value: 'auth-better-auth',
    label: 'Better Auth',
    hint: 'email + password, optional GitHub and Google sign-in, database sessions'
  }
]

/** Question 16b (D-72, D-76): pino by default; Winston or plain JSON lines instead. */
const LOGGERS: Choice<string>[] = [
  { value: NONE, label: 'pino', hint: 'fast JSON logs (recommended)' },
  { value: 'obs-winston', label: 'Winston' },
  { value: 'obs-json-logs', label: 'Plain JSON logs', hint: 'no logging library' }
]

/** Question 10 (D-39): one domain end to end; Weather comes with M4. */
const TEMPLATES: Choice<string>[] = [
  { value: NONE, label: 'None (clean setup)' },
  {
    value: 'template-todo',
    label: 'Todo app',
    hint: 'CRUD, filters, pagination, per user with auth, a page'
  }
]

/** Question 7b (D-38): social sign-in through Better Auth; credentials stay blank in .env. */
const OAUTH_PROVIDERS: Choice<string>[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'google', label: 'Google' }
]

/** Question 18 (D-45): files around the code; all recommended. */
const REPO_EXTRAS: Choice<string>[] = [
  { value: 'repo-agents-md', label: 'AGENTS.md + CLAUDE.md', hint: 'context for AI assistants' },
  { value: 'repo-vscode', label: 'VS Code setup', hint: 'format on save, extensions, debugging' },
  {
    value: 'repo-github-hygiene',
    label: 'GitHub hygiene files',
    hint: 'Dependabot, PR and issue templates, CODEOWNERS'
  }
]

const repoExtrasStep: WizardStep = {
  key: 'repoExtras',
  label: 'Repo extras',
  applies: () => true,
  ask: async (prompter, answers, environment) => {
    const choices = availableIn(environment.registry, REPO_EXTRAS)
    return {
      ...answers,
      repoExtras: await prompter.multiselect({
        message: 'Repo extras',
        choices,
        initialValues: answers.repoExtras ?? choices.map((choice) => choice.value),
        required: false
      })
    }
  },
  describe: (answers) =>
    (answers.repoExtras ?? []).length === 0
      ? 'None'
      : (answers.repoExtras ?? []).map((id) => labelOf(REPO_EXTRAS, id)).join(', '),
  modules: (answers) => [...(answers.repoExtras ?? [])]
}

const oauthProvidersStep: WizardStep = {
  key: 'oauthProviders',
  label: 'OAuth providers',
  applies: (answers) => answers.auth === 'auth-better-auth',
  ask: async (prompter, answers) => ({
    ...answers,
    oauthProviders: await prompter.multiselect({
      message: 'OAuth providers (client id and secret go in .env later)',
      choices: OAUTH_PROVIDERS,
      initialValues: answers.oauthProviders ?? [],
      required: false
    })
  }),
  describe: (answers) =>
    (answers.oauthProviders ?? []).length === 0
      ? 'None'
      : (answers.oauthProviders ?? []).map((id) => labelOf(OAUTH_PROVIDERS, id)).join(', '),
  modules: () => [],
  moduleOptions: (answers) => ({
    'auth-better-auth': Object.fromEntries(
      OAUTH_PROVIDERS.map((choice) => [
        choice.value,
        (answers.oauthProviders ?? []).includes(choice.value)
      ])
    )
  })
}
const ARCHITECTURES: Choice<string>[] = [
  { value: 'arch-feature', label: 'Feature-scoped', hint: 'src/features/<name> per domain' },
  { value: 'arch-clean', label: 'Clean architecture' },
  { value: 'arch-mvc', label: 'MVC' },
  { value: 'arch-flat', label: 'Flat (no extra folders)' }
]

/** Question 4b (D-64): folders of every web app. */
const FRONTEND_ARCHITECTURES: Choice<string>[] = [
  {
    value: 'arch-web-feature',
    label: 'Feature-based',
    hint: 'features/<name>, components/, hooks/'
  },
  { value: 'arch-web-layer', label: 'Layer-based', hint: 'components/, hooks/, utils/' },
  { value: 'arch-web-atomic', label: 'Atomic design', hint: 'atoms, molecules, organisms' }
]

/** Question 12: the test runner; node:test needs nothing extra (D-60). */
const TEST_RUNNERS: Choice<string>[] = [
  { value: 'testing-vitest', label: 'Vitest' },
  { value: 'testing-jest', label: 'Jest', hint: 'native ESM mode, SWC for TypeScript' },
  { value: NONE, label: "Node's built-in test runner", hint: 'node --test, no extra dependency' }
]

/** Question 16a (D-64): how rate limiting counts. */
const RATE_LIMIT_ALGORITHMS: Choice<string>[] = [
  { value: 'fixed-window', label: 'Fixed window', hint: 'N per window; simplest' },
  { value: 'sliding-window', label: 'Sliding window', hint: 'no bursts at window edges' },
  { value: 'token-bucket', label: 'Token bucket', hint: 'allows short bursts' },
  { value: 'leaky-bucket', label: 'Leaky bucket', hint: 'constant rate' }
]

/** Question 16: what app.ts sets up. Security is pre-checked (D-36). */
export const APP_SETUP_CHOICES: Array<Choice<string> & { checked: boolean }> = [
  { value: 'middleware-cors', label: 'CORS', checked: true },
  { value: 'security-helmet', label: 'Helmet security headers', checked: true },
  { value: 'security-rate-limit', label: 'Rate limiting', checked: true },
  { value: 'middleware-request-logger', label: 'Request logging', checked: true },
  { value: 'middleware-compression', label: 'Response compression', checked: false },
  { value: 'security-origin-checks', label: 'Origin allowlist (ALLOWED_ORIGINS)', checked: false }
]

const availableIn = (registry: Registry, choices: Choice<string>[]): Choice<string>[] =>
  choices.filter((choice) => choice.value === NONE || registry.has(choice.value))

const labelOf = (choices: Choice<string>[], value: string | undefined): string =>
  choices.find((choice) => choice.value === value)?.label ?? value ?? '—'

const yesNo = (value: boolean | undefined): string => (value === true ? 'Yes' : 'No')

const isModule = (value: string | undefined): value is string =>
  value !== undefined && value !== NONE

interface SelectStepDefinition {
  key:
    | 'appType'
    | 'framework'
    | 'frontend'
    | 'styling'
    | 'frontendArchitecture'
    | 'database'
    | 'orm'
    | 'auth'
    | 'template'
    | 'logger'
    | 'architecture'
    | 'rateLimitAlgorithm'
    | 'tests'
  label: string
  message: string
  choices: Choice<string>[]
  defaultValue: string
  applies: (answers: WizardAnswers) => boolean
  /** Whether the chosen value is a module id that belongs in the stack. */
  addsModule: boolean
  /** Show each choice's folder tree before asking (task 3.8). */
  preview?: boolean
  /** Narrows the choices by earlier answers, e.g. the ORMs that fit the database. */
  fits?: (value: string, answers: WizardAnswers) => boolean
}

function selectStep(definition: SelectStepDefinition): WizardStep {
  // only module-valued choices depend on what the registry holds
  const options = (answers: WizardAnswers, environment: StepEnvironment): Choice<string>[] =>
    (definition.addsModule
      ? availableIn(environment.registry, definition.choices)
      : definition.choices
    ).filter((choice) => definition.fits?.(choice.value, answers) ?? true)
  // an earlier answer may rule out the previous or the default value (e.g. Prisma on MongoDB)
  const initialValue = (choices: Choice<string>[], answers: WizardAnswers): string | undefined =>
    [answers[definition.key], definition.defaultValue].find((value) =>
      choices.some((choice) => choice.value === value)
    ) ?? choices[0]?.value
  return {
    key: definition.key,
    label: definition.label,
    applies: (answers) => definition.applies(answers),
    options,
    ask: async (prompter, answers, environment) => {
      const choices = options(answers, environment)
      if (definition.preview === true) prompter.note(previewNote(choices), 'Folder layouts')
      const value = await prompter.select({
        message: definition.message,
        choices,
        initialValue: initialValue(choices, answers)
      })
      return { ...answers, [definition.key]: value }
    },
    describe: (answers) => labelOf(definition.choices, answers[definition.key]),
    modules: (answers) => {
      const value = answers[definition.key]
      return definition.addsModule && isModule(value) ? [value] : []
    }
  }
}

interface ConfirmStepDefinition {
  key:
    'preCommit' | 'docker' | 'asyncHandler' | 'admin' | 'apiVersioning' | 'apiDocs' | 'ci' | 'redis'
  label: string
  message: string
  moduleId: string
  defaultValue: boolean
  applies?: (answers: WizardAnswers) => boolean
}

function confirmStep({
  key,
  label,
  message,
  moduleId,
  defaultValue,
  applies = () => true
}: ConfirmStepDefinition): WizardStep {
  return {
    key,
    label,
    applies: (answers) => applies(answers),
    ask: async (prompter, answers) => ({
      ...answers,
      [key]: await prompter.confirm({ message, initialValue: answers[key] ?? defaultValue })
    }),
    describe: (answers) => yesNo(answers[key]),
    modules: (answers) => (answers[key] === true ? [moduleId] : [])
  }
}

/** Every app type today has an API; fullstack adds the web app. */
const isBackend = (answers: WizardAnswers): boolean =>
  answers.appType === 'backend' || answers.appType === FULLSTACK
const isFullstack = (answers: WizardAnswers): boolean => answers.appType === FULLSTACK
/** Auth and the Todo template are written for Prisma on Postgres so far (D-77). */
const onPostgresPrisma = (answers: WizardAnswers): boolean =>
  answers.database === 'database-postgres' && answers.orm === 'orm-prisma'

const packageManagerStep: WizardStep = {
  key: 'packageManager',
  label: 'Package manager',
  applies: (_answers, environment) => environment.fixedPackageManager === undefined,
  ask: async (prompter, answers, environment) => {
    const installed = environment.installedPackageManagers
    const packageManager = await prompter.select<PackageManagerId>({
      message: 'Package manager',
      choices: PACKAGE_MANAGERS.map((id) => ({
        value: id,
        label: id,
        hint: installed === undefined || installed.has(id) ? undefined : 'not installed'
      })),
      initialValue: answers.packageManager ?? environment.defaultPackageManager
    })
    return { ...answers, packageManager }
  },
  describe: (answers, environment) =>
    environment.fixedPackageManager ?? answers.packageManager ?? environment.defaultPackageManager,
  modules: () => []
}

const appSetupStep: WizardStep = {
  key: 'appSetup',
  label: 'App setup',
  applies: (answers) => isModule(answers.framework),
  ask: async (prompter, answers, environment) => {
    const choices = availableIn(environment.registry, APP_SETUP_CHOICES)
    const appSetup = await prompter.multiselect({
      message: 'App setup (app.ts)',
      choices,
      initialValues:
        answers.appSetup ??
        APP_SETUP_CHOICES.filter((choice) => choice.checked).map((choice) => choice.value)
    })
    return { ...answers, appSetup }
  },
  describe: (answers) =>
    (answers.appSetup ?? []).length === 0
      ? 'None'
      : (answers.appSetup ?? []).map((id) => labelOf(APP_SETUP_CHOICES, id)).join(', '),
  modules: (answers) => [...(answers.appSetup ?? [])]
}

/** 16a: asked only when rate limiting is in the app setup; sets the module's option. */
function rateLimitAlgorithmStep(): WizardStep {
  const step = selectStep({
    key: 'rateLimitAlgorithm',
    label: 'Rate-limit algorithm',
    message: 'Rate-limit algorithm',
    choices: RATE_LIMIT_ALGORITHMS,
    defaultValue: 'fixed-window',
    applies: (answers) => (answers.appSetup ?? []).includes('security-rate-limit'),
    addsModule: false
  })
  return {
    ...step,
    moduleOptions: (answers): Record<string, Record<string, unknown>> =>
      answers.rateLimitAlgorithm === undefined
        ? {}
        : { 'security-rate-limit': { algorithm: answers.rateLimitAlgorithm } }
  }
}

export const STEPS: readonly WizardStep[] = [
  selectStep({
    key: 'appType',
    label: 'App type',
    message: 'App type',
    choices: APP_TYPES,
    defaultValue: 'backend',
    applies: () => true,
    addsModule: false
  }),
  selectStep({
    key: 'framework',
    label: 'Framework',
    message: 'Backend framework',
    choices: FRAMEWORKS,
    defaultValue: 'framework-express',
    applies: isBackend,
    addsModule: true
  }),
  selectStep({
    key: 'frontend',
    label: 'Frontend',
    message: 'Frontend framework',
    choices: FRONTENDS,
    defaultValue: 'framework-nextjs',
    applies: isFullstack,
    addsModule: true
  }),
  selectStep({
    key: 'styling',
    label: 'Styling',
    message: 'Styling',
    choices: STYLINGS,
    defaultValue: 'ui-tailwind',
    applies: isFullstack,
    addsModule: true
  }),
  confirmStep({
    key: 'admin',
    label: 'Admin frontend',
    message: 'Add an admin frontend? (apps/admin on port 3002, same API)',
    moduleId: 'app-admin',
    defaultValue: false,
    applies: isFullstack
  }),
  selectStep({
    key: 'frontendArchitecture',
    label: 'Frontend architecture',
    message: 'Frontend architecture',
    choices: FRONTEND_ARCHITECTURES,
    preview: true,
    defaultValue: 'arch-web-feature',
    applies: isFullstack,
    addsModule: true
  }),
  selectStep({
    key: 'database',
    label: 'Database',
    message: 'Database',
    choices: DATABASES,
    defaultValue: 'database-postgres',
    applies: isBackend,
    addsModule: true
  }),
  selectStep({
    key: 'orm',
    label: 'ORM',
    message: 'ORM',
    choices: ORMS,
    defaultValue: 'orm-prisma',
    applies: (answers) => isModule(answers.database),
    addsModule: true,
    fits: (value, answers) => (value === 'orm-mongoose') === (answers.database === MONGODB)
  }),
  confirmStep({
    key: 'redis',
    label: 'Redis',
    message: 'Add Redis (cache, sessions)?',
    moduleId: 'cache-redis',
    defaultValue: false,
    applies: (answers) => isModule(answers.framework)
  }),
  selectStep({
    key: 'auth',
    label: 'Auth',
    message: 'Authentication',
    choices: AUTHS,
    defaultValue: NONE,
    // auth modules: Express, Fastify or Nest, with Prisma on Postgres (M3, M4, D-77)
    applies: (answers) => isModule(answers.framework) && onPostgresPrisma(answers),
    addsModule: true
  }),
  oauthProvidersStep,
  selectStep({
    key: 'logger',
    label: 'Logger',
    message: 'Logger',
    choices: LOGGERS,
    defaultValue: NONE,
    applies: (answers) => isModule(answers.framework),
    addsModule: true
  }),
  selectStep({
    key: 'template',
    label: 'App template',
    message: 'App template',
    choices: TEMPLATES,
    defaultValue: NONE,
    // Todo needs a database; Express + Prisma on Postgres for now (M3, D-77)
    applies: (answers) => answers.framework === 'framework-express' && onPostgresPrisma(answers),
    addsModule: true
  }),
  packageManagerStep,
  selectStep({
    key: 'architecture',
    label: 'Architecture',
    message: 'Backend architecture',
    choices: ARCHITECTURES,
    preview: true,
    defaultValue: 'arch-feature',
    // NestJS brings its own module layout
    applies: (answers) =>
      answers.framework === 'framework-express' || answers.framework === 'framework-fastify',
    addsModule: true
  }),
  confirmStep({
    key: 'preCommit',
    label: 'Pre-commit hooks',
    message: 'Add pre-commit hooks? (Husky, lint-staged, commitlint)',
    moduleId: 'quality-husky',
    defaultValue: true
  }),
  selectStep({
    key: 'tests',
    label: 'Tests',
    message: 'Test runner',
    choices: TEST_RUNNERS,
    defaultValue: 'testing-vitest',
    applies: (answers) => isModule(answers.framework),
    addsModule: true
  }),
  confirmStep({
    key: 'docker',
    label: 'Docker',
    message: 'Add a Dockerfile and docker compose?',
    moduleId: 'devops-docker',
    defaultValue: true
  }),
  confirmStep({
    key: 'apiDocs',
    label: 'API docs',
    message: 'Add API docs? (Scalar at /docs, OpenAPI at /openapi.json)',
    moduleId: 'api-docs-scalar',
    defaultValue: true,
    // the Nest variant (@nestjs/swagger) comes later
    applies: (answers) => isModule(answers.framework)
  }),
  appSetupStep,
  rateLimitAlgorithmStep(),
  confirmStep({
    key: 'apiVersioning',
    label: 'API versioning',
    message: 'Version the API under /v1? (health routes stay unversioned)',
    moduleId: 'api-versioning',
    defaultValue: true,
    applies: (answers) => isModule(answers.framework)
  }),
  confirmStep({
    key: 'ci',
    label: 'CI',
    message: 'Add GitHub Actions CI? (lint, format, typecheck, build, test)',
    moduleId: 'devops-github-actions',
    defaultValue: true
  }),
  confirmStep({
    key: 'asyncHandler',
    label: 'asyncHandler',
    message:
      'Add an asyncHandler() wrapper for routes? (Express 5 forwards async errors without it)',
    moduleId: 'middleware-async-handler',
    defaultValue: false,
    applies: (answers) => answers.framework === 'framework-express'
  }),
  repoExtrasStep
]

/** Options the answers set, per module id; steps that do not apply set nothing. */
export function moduleOptionsFromAnswers(
  answers: WizardAnswers,
  registry: Registry
): Record<string, Record<string, unknown>> {
  const environment: StepEnvironment = { registry, defaultPackageManager: 'npm' }
  return Object.assign(
    {},
    ...STEPS.filter((step) => step.applies(answers, environment)).map(
      (step) => step.moduleOptions?.(answers) ?? {}
    )
  ) as Record<string, Record<string, unknown>>
}

/** The stack the answers describe; steps that do not apply add nothing. */
export function modulesFromAnswers(answers: WizardAnswers, registry: Registry): string[] {
  const environment: StepEnvironment = { registry, defaultPackageManager: 'npm' }
  const chosen = STEPS.filter((step) => step.applies(answers, environment)).flatMap((step) =>
    step.modules(answers)
  )
  // a fullstack app lives in a monorepo: apps/api, apps/web, packages/shared (B8)
  const layout = isFullstack(answers) ? ['layout-monorepo'] : []
  // Vitest for the API also tests the web apps
  // tests and Docker images for the API extend to the web apps
  const webExtras = isFullstack(answers)
    ? [
        ...(chosen.includes('testing-vitest') ? ['testing-vitest-web'] : []),
        ...(chosen.includes('devops-docker') ? ['devops-docker-web'] : [])
      ]
    : []
  return [...new Set([...ALWAYS_INCLUDED, ...layout, ...chosen, ...webExtras])]
}

const firstOf = (modules: readonly string[], choices: Choice<string>[]): string | undefined =>
  choices.find((choice) => modules.includes(choice.value))?.value

/** Pre-fills every answer from a module list, e.g. a preset (A0.2 #0). */
export function answersFromModules(modules: readonly string[]): WizardAnswers {
  const frontend = firstOf(modules, FRONTENDS)
  return {
    appType: frontend === undefined ? 'backend' : FULLSTACK,
    framework: firstOf(modules, FRAMEWORKS),
    frontend,
    styling: frontend === undefined ? undefined : (firstOf(modules, STYLINGS) ?? NONE),
    admin: modules.includes('app-admin'),
    frontendArchitecture: firstOf(modules, FRONTEND_ARCHITECTURES),
    apiVersioning: modules.includes('api-versioning'),
    tests: firstOf(modules, TEST_RUNNERS) ?? NONE,
    apiDocs: modules.includes('api-docs-scalar'),
    ci: modules.includes('devops-github-actions'),
    // a module list carries no options: a preset with rate limiting starts from the default
    rateLimitAlgorithm: modules.includes('security-rate-limit') ? 'fixed-window' : undefined,
    database: firstOf(modules, DATABASES) ?? NONE,
    orm: firstOf(modules, ORMS),
    redis: modules.includes('cache-redis'),
    auth: firstOf(modules, AUTHS) ?? NONE,
    // a module list carries no options: providers start unselected
    oauthProviders: [],
    template: firstOf(modules, TEMPLATES) ?? NONE,
    logger: firstOf(modules, LOGGERS) ?? NONE,
    repoExtras: REPO_EXTRAS.map((choice) => choice.value).filter((id) => modules.includes(id)),
    architecture: firstOf(modules, ARCHITECTURES) ?? 'arch-flat',
    preCommit: modules.includes('quality-husky'),
    docker: modules.includes('devops-docker'),
    asyncHandler: modules.includes('middleware-async-handler'),
    appSetup: APP_SETUP_CHOICES.map((choice) => choice.value).filter((id) => modules.includes(id))
  }
}
