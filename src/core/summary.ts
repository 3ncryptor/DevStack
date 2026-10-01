import { packageManagerAdapter } from '../adapters/package-manager/index'
import type { GenerationPlan } from '../types/plan'
import type { ApplyResult } from './apply/index'
import { projectDirectoryName } from './project-name'

export interface SummaryOptions {
  inPlace: boolean
  skipInstall: boolean
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
  // B17.1: data services first, as a separate step, then the app
  if (scripts['db:up'] !== undefined) steps.push(`${run('db:up')}   # start the database`)
  if (plan.depth === 'bare') {
    steps.push('add your code under src/ (generated with --depth bare: tooling only)')
  } else {
    steps.push(run('dev'))
  }
  return steps
}

function envLines(plan: GenerationPlan): string[] {
  const width = Math.max(...plan.env.map((variable) => variable.name.length))
  return plan.env.map((variable) => {
    const flags = [
      variable.required ? 'required' : 'optional',
      ...(variable.secret ? ['secret'] : [])
    ]
    return `${variable.name.padEnd(width)}  ${flags.join(', ')}: ${variable.description}`
  })
}

function warningLines(plan: GenerationPlan, result: ApplyResult): string[] {
  const warnings = [...new Set(plan.env.flatMap((variable) => variable.warnings))]
  if (result.kept.length > 0) {
    warnings.push(
      `Kept your existing ${result.kept.join(', ')}; generated versions were not written.`
    )
  }
  if (result.backupDir !== undefined) {
    warnings.push(
      `Overwrote ${result.overwritten.join(', ')}; the originals are in ${result.backupDir}`
    )
  }
  return warnings
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `${title}:`, ...lines.map((line) => `  ${line}`)]
}

/** What to do next, what to configure, and what to watch out for (buildPlan B3 "summarise"). */
export function buildSummary(
  plan: GenerationPlan,
  result: ApplyResult,
  options: SummaryOptions
): string {
  return [
    `Project ${plan.projectName} is ready in ${plan.projectDir}`,
    ...section('Next steps', nextSteps(plan, options)),
    ...section('Environment variables (.env.example)', plan.env.length > 0 ? envLines(plan) : []),
    ...section(
      'Warnings',
      warningLines(plan, result).map((warning) => `! ${warning}`)
    )
  ].join('\n')
}
