import type { PackageManagerId } from '../../adapters/package-manager/index'
import { PRESETS, type ResolvedPreset } from '../../core/presets'
import type { ProjectSettings } from '../../core/settings'
import { applyFixAction } from '../../core/resolver/index'
import type { Prompter } from '../../intake/prompter'
import type { Depth } from '../../types/module'
import { runAdvancedPrompt } from '../advanced'
import { runReview, type StackDraft, type WizardServices } from './review'
import {
  ALWAYS_INCLUDED_LABEL,
  answersFromModules,
  moduleOptionsFromAnswers,
  modulesFromAnswers,
  STEPS,
  type StepEnvironment,
  type WizardAnswers,
  type WizardStep
} from './steps'

export type { StackDraft, StackPreview, WizardServices } from './review'

export interface WizardContext extends StepEnvironment {
  projectName: string
  depth: Depth
  /** Modules of a preset given with --preset; pre-fills the answers and skips question 0. */
  presetModules?: readonly string[]
  /** The user's saved presets (task 5.5), offered in question 0 after the built-in ones. */
  userPresets?: readonly ResolvedPreset[]
}

export interface StackSelection {
  modules: string[]
  packageManager: PackageManagerId
  /** Options the answers set, e.g. `{ 'security-rate-limit': { algorithm: 'token-bucket' } }`. */
  moduleOptions: Record<string, Record<string, unknown>>
  /** The user preset picked in question 0, whose settings and options the project takes. */
  preset?: ResolvedPreset
  /** Settings the answers set (the module system), over the preset's. */
  settings?: ProjectSettings
}

const CUSTOM = 'custom'

/** A step whose only compatible option can be taken without asking (e.g. app type today). */
function singleOption(
  step: WizardStep,
  answers: WizardAnswers,
  context: WizardContext
): string | undefined {
  const options = step.options?.(answers, context) ?? []
  return options.length === 1 ? options[0]?.value : undefined
}

async function askStep(
  prompter: Prompter,
  step: WizardStep,
  answers: WizardAnswers,
  context: WizardContext
): Promise<WizardAnswers> {
  const only = singleOption(step, answers, context)
  return only === undefined
    ? step.ask(prompter, answers, context)
    : { ...answers, [step.key]: only }
}

/** Asks, in order, every step that applies and has no answer yet. */
async function fillMissing(
  prompter: Prompter,
  initial: WizardAnswers,
  context: WizardContext
): Promise<WizardAnswers> {
  let answers = initial
  for (const step of STEPS) {
    if (step.applies(answers, context) && answers[step.key] === undefined) {
      answers = await askStep(prompter, step, answers, context)
    }
  }
  return answers
}

interface Start {
  answers: WizardAnswers
  preset?: ResolvedPreset
}

/**
 * A preset's answers: its modules, and the module system from the flag, the preset, the settings
 * or the remembered answer, else ESM. Editable on the review screen like every answer.
 */
function presetAnswers(
  modules: readonly string[],
  context: WizardContext,
  preset?: ResolvedPreset
): WizardAnswers {
  const moduleSystem =
    context.fixedModuleSystem ??
    preset?.settings?.moduleSystem ??
    context.defaultModuleSystem ??
    (context.remembered?.['moduleSystem'] === 'cjs' ? 'cjs' : 'esm')
  return { ...answersFromModules(modules), moduleSystem }
}

async function startingAnswers(prompter: Prompter, context: WizardContext): Promise<Start> {
  if (context.presetModules !== undefined) {
    return { answers: presetAnswers(context.presetModules, context) }
  }
  const saved = context.userPresets ?? []
  const choice = await prompter.select({
    message: 'Start from a preset?',
    choices: [
      { value: CUSTOM, label: 'Custom' },
      ...Object.values(PRESETS).map((preset) => ({
        value: preset.name,
        label: preset.name,
        hint: preset.description
      })),
      ...saved.map((preset) => ({
        value: `user:${preset.name}`,
        label: preset.name,
        hint: `yours: ${preset.description}`
      }))
    ],
    initialValue: CUSTOM
  })
  const builtIn = PRESETS[choice]
  if (builtIn !== undefined) return { answers: presetAnswers(builtIn.modules, context) }
  const mine = saved.find((preset) => `user:${preset.name}` === choice)
  return mine === undefined
    ? { answers: {} }
    : { answers: presetAnswers(mine.modules, context, mine), preset: mine }
}

const packageManagerOf = (answers: WizardAnswers, context: WizardContext): PackageManagerId =>
  context.fixedPackageManager ?? answers.packageManager ?? context.defaultPackageManager

async function editAnswer(
  prompter: Prompter,
  answers: WizardAnswers,
  context: WizardContext
): Promise<WizardAnswers> {
  const editable = STEPS.filter(
    (step) => step.applies(answers, context) && singleOption(step, answers, context) === undefined
  )
  const key = await prompter.select({
    message: 'Which answer?',
    choices: editable.map((step) => ({
      value: step.key,
      label: `${step.label}: ${step.describe(answers, context)}`
    }))
  })
  const step = editable.find((candidate) => candidate.key === key)
  const edited = step === undefined ? answers : await step.ask(prompter, answers, context)
  return fillMissing(prompter, edited, context)
}

/** The guided wizard: A0.2 questions with skip rules, then the review screen. */
export async function runWizard(
  prompter: Prompter,
  context: WizardContext,
  services: WizardServices
): Promise<StackSelection> {
  const start = await startingAnswers(prompter, context)
  const answers = await fillMissing(prompter, start.answers, context)
  const draft = (state: WizardAnswers): StackDraft => ({
    projectName: context.projectName,
    modules: modulesFromAnswers(state, context.registry),
    packageManager: packageManagerOf(state, context),
    depth: context.depth,
    moduleOptions: moduleOptionsFromAnswers(state, context.registry)
  })

  const reviewed = await runReview(
    prompter,
    {
      initial: answers,
      draft,
      rows: (state) => [
        ...STEPS.filter(
          (step) => step.applies(state, context) || step.key === 'packageManager'
        ).map((step): [string, string] => [step.label, step.describe(state, context)]),
        ['Always included', ALWAYS_INCLUDED_LABEL]
      ],
      edit: (state) => editAnswer(prompter, state, context),
      // the project-specific answer (its preset) is not a default worth remembering
      remember: (state) => ({ ...state })
    },
    services
  )
  const { modules, packageManager } = draft(reviewed)
  const asked = STEPS.some((step) => step.key === 'moduleSystem' && step.applies(reviewed, context))
  return {
    modules,
    packageManager,
    moduleOptions: moduleOptionsFromAnswers(reviewed, context.registry),
    ...(start.preset === undefined ? {} : { preset: start.preset }),
    ...(asked && reviewed.moduleSystem !== undefined
      ? { settings: { moduleSystem: reviewed.moduleSystem } }
      : {})
  }
}

/** `--advanced`: pick modules directly, then the same review, which can apply resolver fixes. */
export async function runAdvancedWizard(
  prompter: Prompter,
  context: WizardContext,
  services: WizardServices
): Promise<StackSelection> {
  const packageManager = context.fixedPackageManager ?? context.defaultPackageManager
  const selected = await runAdvancedPrompt(context.registry, prompter, [
    ...(context.presetModules ?? [])
  ])
  const modules = await runReview(
    prompter,
    {
      initial: selected,
      draft: (state) => ({
        projectName: context.projectName,
        modules: state,
        packageManager,
        depth: context.depth
      }),
      rows: (state) => [
        ['Modules', state.join(', ')],
        ['Package manager', packageManager]
      ],
      edit: (state) => runAdvancedPrompt(context.registry, prompter, state),
      applyFix: applyFixAction
    },
    services
  )
  return { modules, packageManager, moduleOptions: {} }
}
