import { canonicalModuleId, MODULE_ALIASES } from '../../modules/aliases'
import type { Diagnostic } from '../../types/diagnostics'
import type { DevstackModule } from '../../types/module'
import { closestId } from './suggest'

export interface Expansion {
  selected: Map<string, DevstackModule>
  diagnostics: Diagnostic[]
}

function unknownModule(
  id: string,
  registry: ReadonlyMap<string, DevstackModule>,
  owner?: string
): Diagnostic {
  const suggestion = closestId(id, [...registry.keys(), ...Object.keys(MODULE_ALIASES)])
  return {
    severity: 'error',
    code: 'unknown-module',
    moduleId: owner,
    message:
      owner === undefined
        ? `Unknown module "${id}".`
        : `Module "${owner}" requires unknown module "${id}".`,
    fix:
      suggestion === undefined
        ? 'List the available modules with --advanced.'
        : `Did you mean "${canonicalModuleId(suggestion)}"?`
  }
}

/**
 * Collects the selected modules plus everything they `require` by id (buildPlan B5 step 1).
 * Requirements naming a capability tag are not pulled in automatically; checks report them.
 */
export function expandSelection(
  requested: readonly string[],
  registry: ReadonlyMap<string, DevstackModule>,
  isTag: (name: string) => boolean
): Expansion {
  const selected = new Map<string, DevstackModule>()
  const diagnostics: Diagnostic[] = []
  const visiting: string[] = []

  const visit = (requestedId: string, owner?: string): void => {
    const id = canonicalModuleId(requestedId)
    if (selected.has(id)) return
    if (visiting.includes(id)) {
      const loop = [...visiting.slice(visiting.indexOf(id)), id].join(' -> ')
      diagnostics.push({
        severity: 'error',
        code: 'cycle',
        moduleId: id,
        message: `Modules require each other in a loop: ${loop}.`,
        fix: 'Remove one of these requirements.'
      })
      return
    }
    const moduleDefinition = registry.get(id)
    if (moduleDefinition === undefined) {
      if (owner === undefined || !isTag(id)) diagnostics.push(unknownModule(id, registry, owner))
      return
    }
    visiting.push(id)
    for (const requirement of moduleDefinition.requires ?? []) visit(requirement, id)
    visiting.pop()
    selected.set(id, moduleDefinition)
  }

  for (const id of requested) visit(id)
  return { selected, diagnostics }
}
