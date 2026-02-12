declare module 'inquirer' {
  export type PromptQuestion = {
    type?: string
    name?: string
    message?: string
    default?: unknown
    choices?: unknown[]
    validate?: (value: unknown) => boolean | string
  }

  export interface InquirerLike {
    prompt<TAnswers extends Record<string, unknown>>(
      questions: ReadonlyArray<PromptQuestion>
    ): Promise<TAnswers>
  }

  const inquirer: InquirerLike
  export default inquirer
}
