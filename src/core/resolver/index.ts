import type { Diagnostic, FixAction } from '../../types/diagnostics'
import type { DevstackModule } from '../../types/module'
import {
  checkCatalog,
  checkConflicts,
  checkRequirements,
  checkSingleSelect,
  checkSlots,
  type CheckContext
} from './checks'
import { expandSelection } from './expand'
import { orderModules } from './order'

export type { Diagnostic, FixAction } from '../../types/diagnostics'

export interface ResolutionResult {
  /** Resolved modules in deterministic order; complete only when there are no error diagnostics. */
  modules: DevstackModule[]
  diagnostics: Diagnostic[]
}

/**
 * Resolves a selection into an ordered stack and every reason it is invalid, in one pass
 * (buildPlan B5). Pure: no filesystem, no prompts.
 */
export function resolveStack(
  requested: readonly string[],
  registry: Map<string, DevstackModule>
): ResolutionResult {
  const tags = new Set(
    [...registry.values()].flatMap((moduleDefinition) => moduleDefinition.provides ?? [])
  )
  const expansion = expandSelection(requested, registry, (name) => tags.has(name))
  const present = new Set(
    [...expansion.selected.values()].flatMap((moduleDefinition) => [
      moduleDefinition.id,
      ...(moduleDefinition.provides ?? [])
    ])
  )
  const context: CheckContext = { selected: expansion.selected, registry, present }

  const diagnostics = [
    ...expansion.diagnostics,
    ...checkRequirements(context),
    ...checkConflicts(context),
    ...checkSingleSelect(context),
    ...checkSlots(context),
    ...checkCatalog(context)
  ]
  return { modules: orderModules(expansion.selected), diagnostics }
}

/** One readable block listing every diagnostic, for errors and logs. */
export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  const lines = diagnostics.flatMap((diagnostic) => [
    `  ${diagnostic.severity === 'error' ? '✖' : '!'} ${diagnostic.message}`,
    ...(diagnostic.fix === undefined ? [] : [`    fix: ${diagnostic.fix}`])
  ])
  return ['The selected modules do not form a valid stack:', ...lines].join('\n')
}

/** The selection after a fix: removed ids dropped, added ids appended once. */
export function applyFixAction(selection: readonly string[], action: FixAction): string[] {
  const kept = selection.filter((id) => !action.remove.includes(id))
  return [...kept, ...action.add.filter((id) => !kept.includes(id))]
}
