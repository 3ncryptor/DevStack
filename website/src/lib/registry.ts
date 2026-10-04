import { moduleChoices, type DevstackModule } from '@repo/src/browser'

import modules from '@/generated/modules.json'

/** DevStack's modules as this checkout's CLI defines them, written by `npm run data` (D-99). */
export const registry: ReadonlyMap<string, DevstackModule> = new Map(
  (modules as unknown as DevstackModule[]).map((moduleDefinition) => [
    moduleDefinition.id,
    moduleDefinition
  ])
)

/** The labels of the modules a wizard question offers, e.g. the backend frameworks. */
export const choiceLabels = (question: Parameters<typeof moduleChoices>[1]): string[] =>
  moduleChoices(registry, question).map((choice) => choice.label)
