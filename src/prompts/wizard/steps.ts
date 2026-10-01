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
  database?: string
  orm?: string
  packageManager?: PackageManagerId
  architecture?: string
  preCommit?: boolean
  docker?: boolean
  appSetup?: string[]
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
}

/** Always configured, never asked (D-35). */
export const ALWAYS_INCLUDED = ['language-node', 'quality-eslint', 'quality-prettier']
export const ALWAYS_INCLUDED_LABEL = 'TypeScript, ESLint, Prettier'

const NONE = 'none'

const APP_TYPES: Choice<string>[] = [{ value: 'backend', label: 'Backend' }]
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
  { value: 'arch-clean', label: 'Clean architecture' },
  { value: 'arch-mvc', label: 'MVC' },
  { value: NONE, label: 'Flat (no extra folders)' }
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
  key: 'appType' | 'framework' | 'database' | 'orm' | 'architecture'
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

function confirmStep(
  key: 'preCommit' | 'docker',
  label: string,
  message: string,
  moduleId: string
): WizardStep {
  return {
    key,
    label,
    applies: () => true,
    ask: async (prompter, answers) => ({
      ...answers,
      [key]: await prompter.confirm({ message, initialValue: answers[key] ?? true })
    }),
    describe: (answers) => yesNo(answers[key]),
    modules: (answers) => (answers[key] === true ? [moduleId] : [])
  }
}

const isBackend = (answers: WizardAnswers): boolean => answers.appType === 'backend'

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
    defaultValue: 'arch-clean',
    // NestJS brings its own module layout
    applies: (answers) => answers.framework === 'framework-express',
    addsModule: true
  }),
  confirmStep(
    'preCommit',
    'Pre-commit hooks',
    'Add pre-commit hooks? (Husky, lint-staged, commitlint)',
    'quality-husky'
  ),
  confirmStep('docker', 'Docker', 'Add a Dockerfile and docker compose?', 'devops-docker'),
  appSetupStep
]

/** The stack the answers describe; steps that do not apply add nothing. */
export function modulesFromAnswers(answers: WizardAnswers, registry: Registry): string[] {
  const environment: StepEnvironment = { registry, defaultPackageManager: 'npm' }
  const chosen = STEPS.filter((step) => step.applies(answers, environment)).flatMap((step) =>
    step.modules(answers)
  )
  return [...new Set([...ALWAYS_INCLUDED, ...chosen])]
}

const firstOf = (modules: readonly string[], choices: Choice<string>[]): string | undefined =>
  choices.find((choice) => modules.includes(choice.value))?.value

/** Pre-fills every answer from a module list, e.g. a preset (A0.2 #0). */
export function answersFromModules(modules: readonly string[]): WizardAnswers {
  const orm = firstOf(modules, ORMS)
  return {
    appType: 'backend',
    framework: firstOf(modules, FRAMEWORKS),
    database: orm === undefined ? NONE : 'postgres',
    orm,
    architecture: firstOf(modules, ARCHITECTURES) ?? NONE,
    preCommit: modules.includes('quality-husky'),
    docker: modules.includes('devops-docker'),
    appSetup: APP_SETUP_CHOICES.map((choice) => choice.value).filter((id) => modules.includes(id))
  }
}
