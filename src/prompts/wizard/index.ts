import type { PackageManagerId } from '../../adapters/package-manager/index'
import { PRESETS } from '../../core/presets'
import { applyFixAction } from '../../core/resolver/index'
import type { Prompter } from '../../intake/prompter'
import type { Depth } from '../../types/module'
import { runAdvancedPrompt } from '../advanced'
import { runReview, type StackDraft, type WizardServices } from './review'
import {
  ALWAYS_INCLUDED_LABEL,
  answersFromModules,
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
}

export interface StackSelection {
  modules: string[]
  packageManager: PackageManagerId
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

async function startingAnswers(prompter: Prompter, context: WizardContext): Promise<WizardAnswers> {
  if (context.presetModules !== undefined) {
    return answersFromModules(context.presetModules)
  }
  const choice = await prompter.select({
    message: 'Start from a preset?',
    choices: [
      { value: CUSTOM, label: 'Custom' },
      ...Object.values(PRESETS).map((preset) => ({
        value: preset.name,
        label: preset.name,
        hint: preset.description
      }))
    ],
    initialValue: CUSTOM
  })
  const preset = PRESETS[choice]
  return preset === undefined ? {} : answersFromModules(preset.modules)
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
  const answers = await fillMissing(prompter, await startingAnswers(prompter, context), context)
  const draft = (state: WizardAnswers): StackDraft => ({
    projectName: context.projectName,
    modules: modulesFromAnswers(state, context.registry),
    packageManager: packageManagerOf(state, context),
    depth: context.depth
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
      edit: (state) => editAnswer(prompter, state, context)
    },
    services
  )
  const { modules, packageManager } = draft(reviewed)
  return { modules, packageManager }
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
  return { modules, packageManager }
}
