import { MODULE_CATEGORIES, type DevstackModule } from '../../types/module'

const categoryRank = (moduleDefinition: DevstackModule): number =>
  MODULE_CATEGORIES.indexOf(moduleDefinition.category)

const compare = (a: DevstackModule, b: DevstackModule): number =>
  categoryRank(a) - categoryRank(b) || a.id.localeCompare(b.id)

/**
 * Requirements first, ties broken by category order then id (buildPlan B5 step 8), so the same set
 * of modules always produces the same order, whatever order it was selected in.
 */
export function orderModules(selected: ReadonlyMap<string, DevstackModule>): DevstackModule[] {
  const remaining = new Map(selected)
  const ordered: DevstackModule[] = []
  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((candidate) =>
        (candidate.requires ?? []).every((requirement) => !remaining.has(requirement))
      )
      .sort(compare)
    // a cycle (already reported as a diagnostic) leaves nothing ready; append the rest in order
    const next = ready[0] ?? [...remaining.values()].sort(compare)[0]
    if (next === undefined) break
    ordered.push(next)
    remaining.delete(next.id)
  }
  return ordered
}
