import type {
  ConfirmPrompt,
  MultiselectPrompt,
  Prompter,
  SelectPrompt,
  TextPrompt
} from './prompter'

/** Values that make the wizard start from scratch and generate at the review. */
const PICKED = new Set(['custom', 'generate'])

/**
 * Answers every question with what it pre-selects (task 5.4): `--yes` with remembered answers
 * runs the real wizard this way, so it follows the same rules (which questions apply, which
 * choices fit) as a user pressing Enter all the way through.
 */
export class DefaultsPrompter implements Prompter {
  text(prompt: TextPrompt): Promise<string> {
    return Promise.resolve(prompt.initialValue ?? '')
  }

  select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    const picked = prompt.choices.find((choice) => PICKED.has(choice.value))?.value
    const value = picked ?? prompt.initialValue ?? prompt.choices[0]?.value
    if (value === undefined) return Promise.reject(new Error(`No choice for: ${prompt.message}`))
    return Promise.resolve(value)
  }

  multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]> {
    return Promise.resolve([...(prompt.initialValues ?? [])])
  }

  confirm(prompt: ConfirmPrompt): Promise<boolean> {
    return Promise.resolve(prompt.initialValue ?? false)
  }

  note(): void {
    // nothing to show: --yes prints the summary instead
  }
}
