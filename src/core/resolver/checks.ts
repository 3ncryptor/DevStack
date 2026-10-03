import { LANGUAGES } from '../../adapters/language/index'
import type { Diagnostic, FixAction } from '../../types/diagnostics'
import { dependencyName, type DevstackModule, type ModuleCategory } from '../../types/module'

/** Categories that allow one module per project (buildPlan B4); more than one is an error. */
export const SINGLE_SELECT_CATEGORIES: ReadonlySet<ModuleCategory> = new Set([
  'language',
  'package-manager',
  'layout',
  'framework',
  'api-style',
  'database',
  'orm',
  'auth',
  'architecture',
  'env',
  'styling',
  'template'
])

export interface CheckContext {
  selected: ReadonlyMap<string, DevstackModule>
  registry: ReadonlyMap<string, DevstackModule>
  /** Ids and capability tags of the selected modules. */
  present: ReadonlySet<string>
}

const providersOf = (
  names: readonly string[],
  registry: ReadonlyMap<string, DevstackModule>
): string[] =>
  [...registry.values()]
    .filter((candidate) =>
      names.some((name) => candidate.id === name || (candidate.provides ?? []).includes(name))
    )
    .map((candidate) => candidate.id)
    .sort()

const addAction = (id: string): FixAction => ({ label: `Add ${id}`, add: [id], remove: [] })
const removeAction = (id: string): FixAction => ({ label: `Remove ${id}`, add: [], remove: [id] })

export function checkRequirements(context: CheckContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const moduleDefinition of context.selected.values()) {
    for (const requirement of moduleDefinition.requires ?? []) {
      if (context.present.has(requirement) || context.registry.has(requirement)) continue
      diagnostics.push({
        severity: 'error',
        code: 'missing-requirement',
        moduleId: moduleDefinition.id,
        message: `Module "${moduleDefinition.id}" requires "${requirement}".`,
        fix: `Add one of: ${providersOf([requirement], context.registry).join(', ')}.`,
        actions: providersOf([requirement], context.registry).map(addAction)
      })
    }
    const anyOf = moduleDefinition.requiresAny ?? []
    if (anyOf.length > 0 && !anyOf.some((name) => context.present.has(name))) {
      diagnostics.push({
        severity: 'error',
        code: 'unmet-requirement',
        moduleId: moduleDefinition.id,
        message: `Module "${moduleDefinition.id}" needs one of: ${anyOf.join(', ')}.`,
        fix: `Add one of: ${providersOf(anyOf, context.registry).join(', ')}.`,
        actions: providersOf(anyOf, context.registry).map(addAction)
      })
    }
  }
  return diagnostics
}

export function checkConflicts(context: CheckContext): Diagnostic[] {
  const reported = new Set<string>()
  const diagnostics: Diagnostic[] = []
  for (const moduleDefinition of context.selected.values()) {
    for (const conflict of moduleDefinition.conflictsWith ?? []) {
      const others = [...context.selected.values()].filter(
        (other) =>
          other.id !== moduleDefinition.id &&
          (other.id === conflict || (other.provides ?? []).includes(conflict))
      )
      for (const other of others) {
        const pair = [moduleDefinition.id, other.id].sort().join('|')
        if (reported.has(pair)) continue
        reported.add(pair)
        diagnostics.push({
          severity: 'error',
          code: 'conflict',
          moduleId: moduleDefinition.id,
          message: `Module "${moduleDefinition.id}" conflicts with "${other.id}".`,
          fix: `Remove "${moduleDefinition.id}" or "${other.id}".`,
          actions: [moduleDefinition.id, other.id].sort().map(removeAction)
        })
      }
    }
  }
  return diagnostics
}

/** One module per category and target (D-04): an API framework and a web framework coexist. */
export function checkSingleSelect(context: CheckContext): Diagnostic[] {
  const byCategory = new Map<string, { category: ModuleCategory; ids: string[] }>()
  for (const moduleDefinition of context.selected.values()) {
    if (!SINGLE_SELECT_CATEGORIES.has(moduleDefinition.category)) continue
    const key = `${moduleDefinition.category}:${moduleDefinition.target ?? 'backend'}`
    const group = byCategory.get(key) ?? { category: moduleDefinition.category, ids: [] }
    byCategory.set(key, { ...group, ids: [...group.ids, moduleDefinition.id] })
  }
  return [...byCategory.values()]
    .map(({ category, ids }): [ModuleCategory, string[]] => [category, ids])
    .filter(([, chosen]) => chosen.length > 1)
    .map(([category, chosen]) => {
      const sorted = [...chosen].sort()
      return {
        severity: 'error' as const,
        code: 'single-select' as const,
        message: `Only one ${category} module can be selected, but ${sorted.length} are: ${sorted.join(', ')}.`,
        fix: `Keep one of: ${sorted.join(', ')}.`,
        actions: sorted.map((kept) => ({
          label: `Keep ${kept}`,
          add: [],
          remove: sorted.filter((id) => id !== kept)
        }))
      }
    })
}

export function checkSlots(context: CheckContext): Diagnostic[] {
  const exposed = new Set(
    [...context.selected.values()].flatMap(
      (moduleDefinition) => moduleDefinition.exposesSlots ?? []
    )
  )
  return [...context.selected.values()].flatMap((moduleDefinition) =>
    (moduleDefinition.slots ?? [])
      // a fragment with `when` may not apply (depth, options); renderSlots checks it after
      // evaluating the condition
      .filter(
        (fragment) =>
          fragment.when === undefined &&
          (fragment.for === undefined || context.selected.has(fragment.for)) &&
          !exposed.has(fragment.slot)
      )
      .map((fragment) => ({
        severity: 'error' as const,
        code: 'unknown-slot' as const,
        moduleId: moduleDefinition.id,
        message: `Module "${moduleDefinition.id}" adds code to slot "${fragment.slot}", but no selected module exposes it.`,
        fix: 'Select a framework that exposes this slot, or remove the module.'
      }))
  )
}

/** Every package a module depends on is in its language's catalog (D-08). */
export function checkCatalog(context: CheckContext): Diagnostic[] {
  return [...context.selected.values()].flatMap((moduleDefinition) => {
    const { catalog } = LANGUAGES[moduleDefinition.language]
    return (
      [...(moduleDefinition.dependencies ?? []), ...(moduleDefinition.devDependencies ?? [])].map(
        dependencyName
      ) as string[]
    )
      .filter((name) => !catalog.has(name))
      .map((name) => ({
        severity: 'error' as const,
        code: 'unknown-package' as const,
        moduleId: moduleDefinition.id,
        message: `Module "${moduleDefinition.id}" depends on "${name}", which is not in the version catalog.`,
        fix: `Add the package to ${catalog.source}.`
      }))
  })
}
