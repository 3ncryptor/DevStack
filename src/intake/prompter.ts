/**
 * Prompt abstraction (D-50). Everything that asks the user a question goes through this
 * interface so the wizard can be tested with a scripted prompter and the library can change
 * without touching callers. Implementations throw `Aborted` when the user cancels.
 */
export interface Choice<T extends string> {
  value: T
  label: string
  hint?: string
}

export interface TextPrompt {
  message: string
  initialValue?: string
  placeholder?: string
  /** Returns an error message for invalid input, or undefined when valid. */
  validate?: (value: string) => string | undefined
}

export interface SelectPrompt<T extends string> {
  message: string
  choices: Choice<T>[]
  initialValue?: T
}

export interface MultiselectPrompt<T extends string> {
  message: string
  choices: Choice<T>[]
  initialValues?: T[]
  required?: boolean
}

export interface ConfirmPrompt {
  message: string
  initialValue?: boolean
}

export interface Prompter {
  text(prompt: TextPrompt): Promise<string>
  select<T extends string>(prompt: SelectPrompt<T>): Promise<T>
  multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]>
  confirm(prompt: ConfirmPrompt): Promise<boolean>
}
