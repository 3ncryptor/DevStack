import { packageManagerAdapter } from '../adapters/package-manager/index'
import type { GenerationPlan } from '../types/plan'
import type { ApplyResult } from './apply/index'
import type { FinishResult } from './finish/index'
import { CLI_PACKAGE } from './manifest'
import { projectDirectoryName } from './project-name'

export interface SummaryOptions {
  inPlace: boolean
  skipInstall: boolean
  /** Commands to run again after one failed (D-95), the failed one first. */
  retry?: readonly string[]
}

/** Scripts of the planned package.json, so steps never name a script that does not exist. */
function plannedScripts(plan: GenerationPlan): Record<string, string> {
  const manifest = plan.files.find((file) => file.path === 'package.json')?.content ?? '{}'
  return (JSON.parse(manifest) as { scripts?: Record<string, string> }).scripts ?? {}
}

function nextSteps(plan: GenerationPlan, options: SummaryOptions): string[] {
  const pm = packageManagerAdapter(plan.packageManager)
  const run = (script: string): string => [plan.packageManager, ...pm.run(script)].join(' ')
  const scripts = plannedScripts(plan)
  const steps: string[] = []
  if (!options.inPlace) steps.push(`cd ${projectDirectoryName(plan.projectName)}`)
  if (options.skipInstall) steps.push(`${plan.packageManager} install`)
  steps.push(...(options.retry ?? []))
  // B17.1: data services first, as a separate step, then the app
  if (scripts['db:up'] !== undefined) steps.push(`${run('db:up')}   # start the database`)
  if (plan.depth === 'bare') {
    steps.push('add your code under src/ (generated with --depth bare: tooling only)')
  } else {
    steps.push(run('dev'))
  }
  return steps
}

/** What to check when a retried command fails again (D-95). */
function debuggingSteps(): string[] {
  return [
    `npx ${CLI_PACKAGE.name} doctor   # Node.js, the package manager, git, Docker`,
    'run the failed command on its own to see its full output'
  ]
}

function envLines(plan: GenerationPlan): string[] {
  const width = Math.max(...plan.env.map((variable) => variable.name.length))
  return plan.env.map((variable) => {
    const flags = [
      variable.required ? 'required' : 'optional',
      ...(variable.secret ? ['secret'] : []),
      ...(variable.generated ? ['random local value in .env'] : [])
    ]
    return `${variable.name.padEnd(width)}  ${flags.join(', ')}: ${variable.description}`
  })
}

function warningLines(plan: GenerationPlan, result: ApplyResult): string[] {
  const warnings = [
    ...new Set([
      ...plan.env.flatMap((variable) => variable.warnings),
      ...plan.env
        .filter((variable) => variable.generated)
        .map(
          (variable) =>
            `${variable.name} in .env is a random value for local development; set your own in production.`
        )
    ])
  ]
  if (result.kept.length > 0) {
    warnings.push(
      `Kept your existing ${result.kept.join(', ')}; generated versions were not written.`
    )
  }
  if (result.merged.length > 0) {
    warnings.push(
      `Added to your existing ${result.merged.join(', ')}; nothing in them was removed.`
    )
  }
  warnings.push(...result.notes)
  if (result.overwritten.length > 0) {
    warnings.push(`Overwrote ${result.overwritten.join(', ')}.`)
  }
  if (result.backupDir !== undefined) {
    warnings.push(`Originals of changed files are in ${result.backupDir}`)
  }
  return warnings
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `${title}:`, ...lines.map((line) => `  ${line}`)]
}

/** What to do next, what to configure, and what to watch out for (buildPlan B3 "summarise"). */
/** Verified, committed, pushed: what happened after the files were written (A0.4). */
function statusLines(finish: FinishResult | undefined): string[] {
  if (finish === undefined) return []
  const { verification, commit, push } = finish
  return [
    verification.status === 'verified'
      ? `Verified ✓ (${[...verification.gates, `boot: ${verification.booted.join(', ') || 'no server'}`].join(', ')})`
      : `Not verified: ${verification.reason}`,
    ...(verification.status === 'verified' ? verification.readiness : []),
    ...(commit === undefined
      ? []
      : [
          commit.status === 'committed'
            ? `Committed ${commit.sha} on main`
            : `Not committed: ${commit.reason}`
        ]),
    ...(push === undefined
      ? []
      : [
          push.status === 'pushed'
            ? `Pushed to ${push.url}`
            : `Not pushed: ${push.reason}${push.retry === undefined ? '' : `\n    retry: ${push.retry}`}`
        ])
  ]
}

export function buildSummary(
  plan: GenerationPlan,
  result: ApplyResult,
  options: SummaryOptions,
  finish?: FinishResult
): string {
  return [
    `Project ${plan.projectName} is ready in ${plan.projectDir}`,
    ...section('Status', statusLines(finish)),
    ...section('Next steps', nextSteps(plan, options)),
    ...section('If a step fails again', options.retry === undefined ? [] : debuggingSteps()),
    ...section('Environment variables (.env.example)', plan.env.length > 0 ? envLines(plan) : []),
    ...section(
      'Warnings',
      warningLines(plan, result).map((warning) => `! ${warning}`)
    )
  ].join('\n')
}
