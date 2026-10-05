import type {
  Choice,
  ConfirmPrompt,
  MultiselectPrompt,
  Prompter,
  SelectPrompt,
  TextPrompt
} from '../../intake/prompter'
import { STEPS, type StepEnvironment, type WizardAnswers, type WizardStep } from './steps'

/** One wizard question as a form field: what it asks, its choices, and the answer it holds. */
export type FormQuestion = { key: keyof WizardAnswers; label: string; message: string } & (
  | { kind: 'select'; choices: Choice<string>[]; value: string }
  | { kind: 'multiselect'; choices: Choice<string>[]; value: string[] }
  | { kind: 'confirm'; value: boolean }
)

/** A question as the prompter saw it, per kind (Omit spread over the union's members). */
type Asked = FormQuestion extends infer Question
  ? Question extends FormQuestion
    ? Omit<Question, 'key' | 'label' | 'value'>
    : never
  : never

/**
 * A prompter that asks nobody: it records the question a step asks and answers with the
 * visitor's pick, or the step's own default when there is no pick or it no longer fits.
 */
class FormPrompter implements Prompter {
  asked: Asked | undefined

  constructor(private readonly pick: unknown) {}

  select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    this.asked = { kind: 'select', message: prompt.message, choices: prompt.choices }
    const picked = prompt.choices.find((choice) => choice.value === this.pick)
    return Promise.resolve(picked?.value ?? prompt.initialValue ?? prompt.choices[0]?.value)
  }

  multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]> {
    this.asked = { kind: 'multiselect', message: prompt.message, choices: prompt.choices }
    if (!Array.isArray(this.pick)) return Promise.resolve(prompt.initialValues ?? [])
    const offered = new Set<string>(prompt.choices.map((choice) => choice.value))
    return Promise.resolve(this.pick.filter((value): value is T => offered.has(value as string)))
  }

  confirm(prompt: ConfirmPrompt): Promise<boolean> {
    this.asked = { kind: 'confirm', message: prompt.message }
    return Promise.resolve(
      typeof this.pick === 'boolean' ? this.pick : (prompt.initialValue ?? false)
    )
  }

  text(prompt: TextPrompt): Promise<string> {
    throw new Error(`a form cannot ask free text: ${prompt.message}`)
  }

  note(): void {
    // a form has no notes to show
  }
}

/** A step whose options hold exactly one choice is answered without asking, as in the CLI. */
function onlyOption(
  step: WizardStep,
  answers: WizardAnswers,
  environment: StepEnvironment
): string | undefined {
  const options = step.options?.(answers, environment) ?? []
  return options.length === 1 ? options[0]?.value : undefined
}

/**
 * The wizard as a form (the website's builder, D-99): walks the steps in the CLI's order, each
 * answered by `picks` or its default, and returns the questions that were asked with the full
 * answers. Earlier answers decide later questions, exactly as in the terminal.
 */
export async function wizardForm(
  picks: Readonly<WizardAnswers>,
  environment: StepEnvironment
): Promise<{ questions: FormQuestion[]; answers: WizardAnswers }> {
  let answers: WizardAnswers = {}
  const questions: FormQuestion[] = []
  for (const step of STEPS) {
    if (!step.applies(answers, environment)) continue
    const only = onlyOption(step, answers, environment)
    if (only !== undefined) {
      answers = { ...answers, [step.key]: only }
      continue
    }
    const prompter = new FormPrompter(picks[step.key])
    answers = await step.ask(prompter, answers, environment)
    if (prompter.asked !== undefined) {
      questions.push({
        key: step.key,
        label: step.label,
        ...prompter.asked,
        value: answers[step.key]
      } as FormQuestion)
    }
  }
  return { questions, answers }
}
