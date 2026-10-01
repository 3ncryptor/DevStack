import { packageManagerAdapter } from '../adapters/package-manager/index'
import type { GenerationPlan } from '../types/plan'
import type { ApplyResult } from './apply/index'
import { projectDirectoryName } from './project-name'

export interface SummaryOptions {
  inPlace: boolean
  skipInstall: boolean
}

function nextSteps(plan: GenerationPlan, options: SummaryOptions): string[] {
  const pm = packageManagerAdapter(plan.packageManager)
  const run = (script: string): string => [plan.packageManager, ...pm.run(script)].join(' ')
  const steps: string[] = []
  if (!options.inPlace) steps.push(`cd ${projectDirectoryName(plan.projectName)}`)
  if (options.skipInstall) steps.push(`${plan.packageManager} install`)
  if (plan.env.length > 0) steps.push('cp .env.example .env   # then fill in the values below')
  if (plan.modules.includes('orm-prisma')) steps.push(run('prisma:migrate'))
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
