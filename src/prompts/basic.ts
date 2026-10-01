import type { Choice, Prompter } from '../intake/prompter'
import type { DevstackModule } from '../types/module'

type Registry = Map<string, DevstackModule>

interface ModuleChoice extends Choice<string> {
  checked?: boolean
}

const FRAMEWORKS: ModuleChoice[] = [
  { value: 'framework-express', label: 'Express' },
  { value: 'framework-nest', label: 'NestJS' }
]

const ARCHITECTURES: ModuleChoice[] = [
  { value: 'arch-clean', label: 'Clean architecture' },
  { value: 'arch-mvc', label: 'MVC' }
]

const QUALITY: ModuleChoice[] = [
  { value: 'quality-eslint', label: 'ESLint', checked: true },
  { value: 'quality-prettier', label: 'Prettier', checked: true },
  { value: 'quality-husky', label: 'Husky + lint-staged + commitlint', checked: true }
]

const SECURITY: ModuleChoice[] = [
  { value: 'middleware-cors', label: 'CORS middleware', checked: true },
  { value: 'security-origin-checks', label: 'Origin allowlist checks (ALLOWED_ORIGINS)' },
  { value: 'security-helmet', label: 'Helmet security headers', checked: true },
  { value: 'security-rate-limit', label: 'Rate limiting', checked: true },
  { value: 'middleware-request-logger', label: 'HTTP request logger (morgan)', checked: true },
  { value: 'middleware-compression', label: 'Response compression' }
]

const EXTRAS: ModuleChoice[] = [{ value: 'devops-docker', label: 'Docker setup' }]

function available(registry: Registry, choices: ModuleChoice[]): ModuleChoice[] {
  return choices.filter((choice) => registry.has(choice.value))
}

async function pickMany(
  prompter: Prompter,
  registry: Registry,
  message: string,
  choices: ModuleChoice[]
): Promise<string[]> {
  const options = available(registry, choices)
  if (options.length === 0) {
    return []
  }
  const initialValues = options.filter((choice) => choice.checked).map((choice) => choice.value)
  return prompter.multiselect({ message, choices: options, initialValues })
}

export async function runBasicPrompt(
  registry: Registry,
  prompter: Prompter
): Promise<{ selectedModules: string[] }> {
  const selected: string[] = []

  selected.push(
    await prompter.select({
      message: 'Select language/runtime',
      choices: [{ value: 'language-node', label: 'Node.js + TypeScript' }],
      initialValue: 'language-node'
    })
  )

  const frameworks = available(registry, FRAMEWORKS)
  if (frameworks.length === 0) {
    throw new Error('No framework modules available. Install framework modules first.')
  }
  const framework = await prompter.select({
    message: 'Select backend framework',
    choices: frameworks,
    initialValue: frameworks[0]?.value
  })
  selected.push(framework)

  const databases = [
    ...available(registry, [{ value: 'orm-prisma', label: 'Prisma + PostgreSQL' }]),
    { value: 'none', label: 'None' }
  ]
  const database = await prompter.select({
    message: 'Select database layer',
    choices: databases,
    initialValue: databases[0]?.value
  })
  if (database !== 'none') {
    selected.push(database)
  }

  const architectures = available(registry, ARCHITECTURES)
  if (framework === 'framework-express' && architectures.length > 0) {
    selected.push(
      await prompter.select({
        message: 'Select folder architecture',
        choices: architectures,
        initialValue: architectures[0]?.value
      })
    )
  }

  selected.push(...(await pickMany(prompter, registry, 'Select quality tooling', QUALITY)))
  selected.push(
    ...(await pickMany(prompter, registry, 'Select API security and middleware features', SECURITY))
  )
  selected.push(...(await pickMany(prompter, registry, 'Select optional platform extras', EXTRAS)))

  return {
    selectedModules: [...new Set(selected)].filter((moduleName) => registry.has(moduleName))
  }
}
