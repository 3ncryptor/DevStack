import * as clack from '@clack/prompts'

import { Aborted } from '../errors'
import type {
  Choice,
  ConfirmPrompt,
  MultiselectPrompt,
  Prompter,
  SelectPrompt,
  TextPrompt
} from './prompter'

function abort(): never {
  clack.cancel('Cancelled.')
  throw new Aborted()
}

type ClackOptions<T extends string> = Parameters<typeof clack.select<T>>[0]['options']

function toOptions<T extends string>(choices: Choice<T>[]): ClackOptions<T> {
  // clack's Option<T> is a conditional type that TypeScript cannot resolve for a generic T;
  // for string values it is exactly { value, label?, hint? }.
  return choices.map((choice) => ({
    value: choice.value,
    label: choice.label,
    hint: choice.hint
  })) as ClackOptions<T>
}

/** `Prompter` backed by @clack/prompts (D-50). */
export class ClackPrompter implements Prompter {
  async text(prompt: TextPrompt): Promise<string> {
    const value = await clack.text({
      message: prompt.message,
      initialValue: prompt.initialValue,
      placeholder: prompt.placeholder,
      validate: prompt.validate ? (input) => prompt.validate?.(input ?? '') : undefined
    })
    return clack.isCancel(value) ? abort() : value
  }

  async select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    const value = await clack.select<T>({
      message: prompt.message,
      options: toOptions(prompt.choices),
      initialValue: prompt.initialValue
    })
    return clack.isCancel(value) ? abort() : value
  }

  async multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]> {
    const value = await clack.multiselect<T>({
      message: prompt.message,
      options: toOptions(prompt.choices),
      initialValues: prompt.initialValues,
      required: prompt.required ?? false
    })
    return clack.isCancel(value) ? abort() : value
  }

  async confirm(prompt: ConfirmPrompt): Promise<boolean> {
    const value = await clack.confirm({
      message: prompt.message,
      initialValue: prompt.initialValue
    })
    return clack.isCancel(value) ? abort() : value
  }

  note(message: string, title?: string): void {
    clack.note(message, title)
  }
}
