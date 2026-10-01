import type {
  ConfirmPrompt,
  MultiselectPrompt,
  Prompter,
  SelectPrompt,
  TextPrompt
} from '../../src/intake/prompter'

/**
 * A Prompter that answers by question text: listed questions get their answers in order (a
 * question asked twice, like "What next?", takes the next one), every other question gets the
 * wizard's own default, as if the user pressed Enter. Adding a question to the wizard then only
 * affects the tests that care about it.
 */
export class AnswerPrompter implements Prompter {
  readonly asked: string[] = []
  /** Every note shown, as "title: message". */
  readonly notes: string[] = []
  private readonly queues = new Map<string, unknown[]>()

  constructor(answers: ReadonlyArray<readonly [message: string, answer: unknown]> = []) {
    for (const [message, answer] of answers) {
      this.queues.set(message, [...(this.queues.get(message) ?? []), answer])
    }
  }

  private answer<T>(message: string, fallback: () => T): Promise<T> {
    this.asked.push(message)
    const queue = this.queues.get(message)
    if (queue !== undefined && queue.length > 0) {
      return Promise.resolve(queue.shift() as T)
    }
    return Promise.resolve(fallback())
  }

  /** Answers the test gave that were never asked: a typo, or a question that was skipped. */
  unused(): string[] {
    return [...this.queues.entries()]
      .filter(([, queue]) => queue.length > 0)
      .map(([message]) => message)
  }

  text(prompt: TextPrompt): Promise<string> {
    return this.answer(prompt.message, () => prompt.initialValue ?? '')
  }

  select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    return this.answer(prompt.message, () => {
      const fallback = prompt.initialValue ?? prompt.choices[0]?.value
      if (fallback === undefined) throw new Error(`No default for: ${prompt.message}`)
      return fallback
    })
  }

  multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]> {
    return this.answer(prompt.message, () => [...(prompt.initialValues ?? [])])
  }

  confirm(prompt: ConfirmPrompt): Promise<boolean> {
    return this.answer(prompt.message, () => prompt.initialValue ?? false)
  }

  note(message: string, title?: string): void {
    this.notes.push(title === undefined ? message : `${title}: ${message}`)
  }
}
