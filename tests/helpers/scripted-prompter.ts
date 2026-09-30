import type {
  ConfirmPrompt,
  MultiselectPrompt,
  Prompter,
  SelectPrompt,
  TextPrompt
} from '../../src/intake/prompter'

/** A Prompter that returns pre-recorded answers in order and records every question asked. */
export class ScriptedPrompter implements Prompter {
  readonly asked: string[] = []

  constructor(private readonly answers: unknown[]) {}

  private next<T>(message: string): Promise<T> {
    this.asked.push(message)
    if (this.answers.length === 0) {
      throw new Error(`No scripted answer left for: ${message}`)
    }
    return Promise.resolve(this.answers.shift() as T)
  }

  text(prompt: TextPrompt): Promise<string> {
    return this.next(prompt.message)
  }

  select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    return this.next(prompt.message)
  }

  multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]> {
    return this.next(prompt.message)
  }

  confirm(prompt: ConfirmPrompt): Promise<boolean> {
    return this.next(prompt.message)
  }
}
