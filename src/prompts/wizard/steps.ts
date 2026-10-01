import { PACKAGE_MANAGERS, type PackageManagerId } from '../../adapters/package-manager/index'
import type { Choice, Prompter } from '../../intake/prompter'
import type { DevstackModule } from '../../types/module'

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
  packageManager?: PackageManagerId
  architecture?: string
  preCommit?: boolean
  docker?: boolean
  appSetup?: string[]
  rateLimitAlgorithm?: string
  apiVersioning?: boolean
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
  { value: 'framework-nest', label: 'NestJS' }
]
const DATABASES: Choice<string>[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: NONE, label: 'None' }
]
const ORMS: Choice<string>[] = [{ value: 'orm-prisma', label: 'Prisma' }]
const ARCHITECTURES: Choice<string>[] = [
  { value: 'arch-feature', label: 'Feature-scoped', hint: 'src/features/<name> per domain' },
  { value: 'arch-clean', label: 'Clean architecture' },
  { value: 'arch-mvc', label: 'MVC' },
  { value: NONE, label: 'Flat (no extra folders)' }
]

/** Question 4b (D-64): folders of every web app. */
const FRONTEND_ARCHITECTURES: Choice<string>[] = [
  {
    value: 'arch-web-feature',
    label: 'Feature-based',
    hint: 'features/<name>, components/, hooks/'
  },
  { value: 'arch-web-layer', label: 'Layer-based', hint: 'components/, services/, utils/' },
  { value: 'arch-web-atomic', label: 'Atomic design', hint: 'atoms, molecules, organisms' }
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
    | 'architecture'
    | 'rateLimitAlgorithm'
  label: string
  message: string
  choices: Choice<string>[]
  defaultValue: string
  applies: (answers: WizardAnswers) => boolean
  /** Whether the chosen value is a module id that belongs in the stack. */
  addsModule: boolean
}

function selectStep(definition: SelectStepDefinition): WizardStep {
  // only module-valued choices depend on what the registry holds
  const options = (_answers: WizardAnswers, environment: StepEnvironment): Choice<string>[] =>
    definition.addsModule
      ? availableIn(environment.registry, definition.choices)
      : definition.choices
  return {
    key: definition.key,
    label: definition.label,
    applies: (answers) => definition.applies(answers),
    options,
    ask: async (prompter, answers, environment) => {
      const choices = options(answers, environment)
      const value = await prompter.select({
        message: definition.message,
        choices,
        initialValue: answers[definition.key] ?? definition.defaultValue
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
  key: 'preCommit' | 'docker' | 'asyncHandler' | 'admin' | 'apiVersioning'
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
    defaultValue: 'arch-web-feature',
    applies: isFullstack,
    addsModule: true
  }),
  selectStep({
    key: 'database',
    label: 'Database',
    message: 'Database',
    choices: DATABASES,
    defaultValue: 'postgres',
    applies: isBackend,
    addsModule: false
  }),
  selectStep({
    key: 'orm',
    label: 'ORM',
    message: 'ORM',
    choices: ORMS,
    defaultValue: 'orm-prisma',
    applies: (answers) => isModule(answers.database),
    addsModule: true
  }),
  packageManagerStep,
  selectStep({
    key: 'architecture',
    label: 'Architecture',
    message: 'Backend architecture',
    choices: ARCHITECTURES,
    defaultValue: 'arch-feature',
    // NestJS brings its own module layout
    applies: (answers) => answers.framework === 'framework-express',
    addsModule: true
  }),
  confirmStep({
    key: 'preCommit',
    label: 'Pre-commit hooks',
    message: 'Add pre-commit hooks? (Husky, lint-staged, commitlint)',
    moduleId: 'quality-husky',
    defaultValue: true
  }),
  confirmStep({
    key: 'docker',
    label: 'Docker',
    message: 'Add a Dockerfile and docker compose?',
    moduleId: 'devops-docker',
    defaultValue: true,
    // per-app images for the monorepo come with Docker v2 (task 3.7)
    applies: (answers) => !isFullstack(answers)
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
    key: 'asyncHandler',
    label: 'asyncHandler',
    message:
      'Add an asyncHandler() wrapper for routes? (Express 5 forwards async errors without it)',
    moduleId: 'middleware-async-handler',
    defaultValue: false,
    applies: (answers) => answers.framework === 'framework-express'
  })
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
  return [...new Set([...ALWAYS_INCLUDED, ...layout, ...chosen])]
}

const firstOf = (modules: readonly string[], choices: Choice<string>[]): string | undefined =>
  choices.find((choice) => modules.includes(choice.value))?.value

/** Pre-fills every answer from a module list, e.g. a preset (A0.2 #0). */
export function answersFromModules(modules: readonly string[]): WizardAnswers {
  const orm = firstOf(modules, ORMS)
  const frontend = firstOf(modules, FRONTENDS)
  return {
    appType: frontend === undefined ? 'backend' : FULLSTACK,
    framework: firstOf(modules, FRAMEWORKS),
    frontend,
    styling: frontend === undefined ? undefined : (firstOf(modules, STYLINGS) ?? NONE),
    admin: modules.includes('app-admin'),
    frontendArchitecture: firstOf(modules, FRONTEND_ARCHITECTURES),
    apiVersioning: modules.includes('api-versioning'),
    // a module list carries no options: a preset with rate limiting starts from the default
    rateLimitAlgorithm: modules.includes('security-rate-limit') ? 'fixed-window' : undefined,
    database: orm === undefined ? NONE : 'postgres',
    orm,
    architecture: firstOf(modules, ARCHITECTURES) ?? NONE,
    preCommit: modules.includes('quality-husky'),
    docker: modules.includes('devops-docker'),
    asyncHandler: modules.includes('middleware-async-handler'),
    appSetup: APP_SETUP_CHOICES.map((choice) => choice.value).filter((id) => modules.includes(id))
  }
}
