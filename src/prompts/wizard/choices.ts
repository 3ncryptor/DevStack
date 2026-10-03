import { resolveStack } from '../../core/resolver/index'
import type { Diagnostic } from '../../types/diagnostics'
import type { Choice } from '../../intake/prompter'
import type { DevstackModule, WizardQuestion } from '../../types/module'

export type Registry = ReadonlyMap<string, DevstackModule>

/** A module offered by a wizard question; `checked` pre-selects it in a multi-select. */
export interface ModuleChoice extends Choice<string> {
  checked: boolean
}

/** The modules a question offers, in their declared order (D-96). */
export function moduleChoices(registry: Registry, question: WizardQuestion): ModuleChoice[] {
  return [...registry.values()]
    .flatMap((moduleDefinition) =>
      moduleDefinition.wizard?.question === question
        ? [{ moduleDefinition, wizard: moduleDefinition.wizard }]
        : []
    )
    .sort((a, b) => a.wizard.order - b.wizard.order)
    .map(({ moduleDefinition, wizard }) => ({
      value: moduleDefinition.id,
      label: wizard.label ?? moduleDefinition.title,
      ...(wizard.hint === undefined ? {} : { hint: wizard.hint }),
      checked: wizard.checked ?? false
    }))
}

const errorsOf = (diagnostics: readonly Diagnostic[]): string[] =>
  diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.message)

/**
 * Whether `candidate` joins the modules chosen so far: the modules' own requirements and
 * conflicts decide what the wizard offers, e.g. Mongoose only on MongoDB. A candidate fits when it
 * adds no resolver error and does not pull in a module another question answers (auth would add
 * Prisma and Postgres after the user chose no database).
 */
export function fitsStack(
  registry: Registry,
  chosen: readonly string[],
  candidate: string
): boolean {
  const before = resolveStack([...chosen], registry)
  const after = resolveStack([...chosen, candidate], registry)
  const errorsBefore = new Set(errorsOf(before.diagnostics))
  const resolvedBefore = new Set(before.modules.map((moduleDefinition) => moduleDefinition.id))
  const question = registry.get(candidate)?.wizard?.question
  const answersAnother = after.modules.some(
    (moduleDefinition) =>
      !resolvedBefore.has(moduleDefinition.id) &&
      moduleDefinition.wizard !== undefined &&
      moduleDefinition.wizard.question !== question
  )
  return !answersAnother && errorsOf(after.diagnostics).every((error) => errorsBefore.has(error))
}
