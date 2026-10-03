import { packageManagerAdapter, type PackageManagerId } from '../../adapters/package-manager/index'
import type { DevstackModule } from '../../types/module'
import type { PackageJson } from '../../types/package-json'
import { MANIFEST_PATH } from '../manifest'

export interface AgentsMdInput {
  projectName: string
  packageManager: PackageManagerId
  modules: readonly DevstackModule[]
  packageJson: PackageJson
  /** Workspace folders by role, e.g. backend → apps/api; empty in the single layout. */
  targetDirs: Readonly<Record<string, string>>
  /** `features` or `modules` (B17.6). */
  domainsDir: string
}

/** The project's gates, in the order an agent should run them before handing work back. */
const GATES = ['lint', 'format', 'typecheck', 'test', 'build'] as const

const APP_ROLES: Readonly<Record<string, string>> = {
  backend: 'the API',
  frontend: 'the web app',
  admin: 'the admin app',
  shared: 'types and the API client shared by the apps'
}

/** One kind of note from every module that has it, each line once. */
const notes = (input: AgentsMdInput, kind: 'layout' | 'conventions'): string[] => [
  ...new Set(input.modules.flatMap((moduleDefinition) => moduleDefinition.agentsMd?.[kind] ?? []))
]

function commands(input: AgentsMdInput): string[] {
  const pm = packageManagerAdapter(input.packageManager)
  const scripts = input.packageJson.scripts ?? {}
  const run = (name: string): string => [input.packageManager, ...pm.run(name)].join(' ')
  return [
    '## Commands',
    '',
    `Package manager: ${input.packageManager}. Run from the repository root.`,
    '',
    ...['dev', 'db:up', 'db:migrate']
      .filter((name) => scripts[name] !== undefined)
      .map((name) => `- \`${run(name)}\``),
    '',
    'Before handing work back, run every check and fix what fails:',
    '',
    '```bash',
    ...GATES.filter((name) => scripts[name] !== undefined).map(run),
    '```'
  ]
}

function layout(input: AgentsMdInput): string[] {
  const api = input.targetDirs.backend ?? ''
  const apiPrefix = api === '' ? '' : `${api}/`
  const apps = Object.entries(input.targetDirs)
    .filter(([role]) => APP_ROLES[role] !== undefined)
    .map(([role, dir]) => `- \`${dir}/\`: ${APP_ROLES[role] ?? role}`)
  return [
    '## Layout',
    '',
    ...apps,
    `- \`${apiPrefix}src/${input.domainsDir}/<feature>/\`: one folder per feature (service, repository interface, routes)`,
    `- \`${apiPrefix}src/lib/\`: errors, the response envelope, the logger; \`${apiPrefix}src/config/env.ts\` validates the environment`,
    ...notes(input, 'layout').map((line) => line.replaceAll('{{api}}', apiPrefix))
  ]
}

function conventions(input: AgentsMdInput): string[] {
  return [
    '## Conventions',
    '',
    '- Every response uses the envelope `{ success: true, data }` or `{ success: false, error }`: throw the errors in `lib/errors.ts`, never send ad hoc error bodies.',
    '- Validate every request body, query and params with Zod (`validate()`); never trust input.',
    '- Feature code depends on repository interfaces, never on the ORM: adapters live in `db/repositories`, tests use in-memory doubles.',
    '- A new environment variable goes in `config/env.ts` and `.env.example`; secrets never go in code.',
    ...notes(input, 'conventions')
  ]
}

function storageStep(input: AgentsMdInput): string {
  const storage = input.modules.find((moduleDefinition) => moduleDefinition.agentsMd?.storage)
  return `2. ${storage?.agentsMd?.storage ?? 'Implement the repository interface for your storage.'}`
}

function addingAFeature(input: AgentsMdInput): string[] {
  return [
    '## Adding a feature',
    '',
    `1. Create \`${input.domainsDir}/<feature>/\` with a service and a repository interface.`,
    storageStep(input),
    '3. Add routes with Zod validation and mount them in `app.ts`; wire dependencies in `index.ts` (the composition root).',
    '4. Add tests next to the existing ones, building the app with `testApp()` from `tests/helpers/app.ts`.'
  ]
}

/**
 * AGENTS.md (B17.9, D-45): what an AI coding assistant needs to work in this project, built from
 * the resolved stack. CLAUDE.md imports it, so every assistant reads the same file.
 */
export function agentsMd(input: AgentsMdInput): string {
  const sections = [
    [
      `# ${input.projectName}: notes for AI assistants`,
      '',
      `Stack: ${input.modules.map((moduleDefinition) => moduleDefinition.title).join(', ')}.`,
      `It is recorded in \`${MANIFEST_PATH}\`.`
    ],
    commands(input),
    layout(input),
    conventions(input),
    addingAFeature(input)
  ]
  return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`
}

/** Claude Code reads CLAUDE.md; importing AGENTS.md keeps one source for every assistant. */
export const CLAUDE_MD = '@AGENTS.md\n'
