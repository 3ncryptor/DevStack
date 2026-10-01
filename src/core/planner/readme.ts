import { packageManagerAdapter, type PackageManagerId } from '../../adapters/package-manager/index'
import type { DevstackModule } from '../../types/module'
import type { PackageJson } from '../../types/package-json'
import type { PlannedEnvVar } from '../../types/plan'
import { CLI_PACKAGE, MANIFEST_PATH } from '../manifest'

export interface ReadmeInput {
  projectName: string
  packageManager: PackageManagerId
  modules: readonly DevstackModule[]
  packageJson: PackageJson
  env: readonly PlannedEnvVar[]
}

/** Scripts shown under "Getting started", in the order a new developer runs them. */
const FIRST_RUN_SCRIPTS = ['db:up', 'dev'] as const

/** Markdown table cell: pipes would end the cell early. */
const cell = (value: string): string => value.replaceAll('|', '\\|')

function gettingStarted(input: ReadmeInput, scripts: Record<string, string>): string[] {
  const pm = packageManagerAdapter(input.packageManager)
  const steps = FIRST_RUN_SCRIPTS.filter((name) => scripts[name] !== undefined).map((name) =>
    [input.packageManager, ...pm.run(name)].join(' ')
  )
  return ['## Getting started', '', '```bash', ...steps, '```']
}

function scriptTable(scripts: Record<string, string>): string[] {
  return [
    '## Scripts',
    '',
    '| Script | Runs |',
    '| --- | --- |',
    ...Object.entries(scripts).map(([name, run]) => `| \`${name}\` | \`${cell(run)}\` |`)
  ]
}

function envTable(env: readonly PlannedEnvVar[]): string[] {
  if (env.length === 0) return []
  return [
    '## Environment',
    '',
    'A local `.env` with working defaults was generated; `.env.example` documents every variable.',
    'The app validates these at startup and lists every missing or invalid one.',
    '',
    '| Variable | Required | Description |',
    '| --- | --- | --- |',
    ...env.map(
      (variable) =>
        `| \`${variable.name}\` | ${variable.required ? 'yes' : 'no'} | ${cell(variable.description)} |`
    )
  ]
}

/** The generated project's README (B17.2): stack, first commands, scripts and env vars. */
export function projectReadme(input: ReadmeInput): string {
  const scripts = input.packageJson.scripts ?? {}
  const sections = [
    [`# ${input.projectName}`, '', `Generated with ${CLI_PACKAGE.name} ${CLI_PACKAGE.version}.`],
    ['## Stack', '', ...input.modules.map((moduleDefinition) => `- ${moduleDefinition.title}`)],
    gettingStarted(input, scripts),
    scriptTable(scripts),
    envTable(input.env),
    [
      '## Regenerate',
      '',
      `\`${MANIFEST_PATH}\` records this stack. Generate the same project again with`,
      `\`npx ${CLI_PACKAGE.name} <name> --config ${MANIFEST_PATH}\`.`
    ]
  ].filter((section) => section.length > 0)
  return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`
}
