import { ResolutionError } from '../../errors'
import type { DevstackModule, SlotContribution } from '../../types/module'

const DEFAULT_ORDER = 100

interface PlacedFragment extends SlotContribution {
  owner: string
  moduleIndex: number
}

/**
 * Collects the code fragments selected modules contribute to framework slots (D-07, buildPlan B6).
 * Fragments render in `order`, then module order; identical fragments appear once. What you
 * selected is what is imported; nothing is discovered at runtime.
 */
export function renderSlots(
  modules: readonly DevstackModule[],
  include: (moduleDefinition: DevstackModule, fragment: SlotContribution) => boolean = () => true
): Record<string, string> {
  const selected = new Set(modules.map((moduleDefinition) => moduleDefinition.id))
  const exposed = new Set(
    modules.flatMap((moduleDefinition) => moduleDefinition.exposesSlots ?? [])
  )

  const fragments: PlacedFragment[] = modules.flatMap((moduleDefinition, moduleIndex) =>
    (moduleDefinition.slots ?? [])
      .filter((contribution) => contribution.for === undefined || selected.has(contribution.for))
      .filter((contribution) => include(moduleDefinition, contribution))
      .map((contribution) => ({ ...contribution, owner: moduleDefinition.id, moduleIndex }))
  )

  for (const fragment of fragments) {
    if (!exposed.has(fragment.slot)) {
      throw new ResolutionError(
        `Module "${fragment.owner}" adds code to slot "${fragment.slot}", but no selected module exposes it.`
      )
    }
  }

  const rendered: Record<string, string> = {}
  for (const slot of exposed) {
    const code = fragments
      .filter((fragment) => fragment.slot === slot)
      .sort(
        (a, b) =>
          (a.order ?? DEFAULT_ORDER) - (b.order ?? DEFAULT_ORDER) || a.moduleIndex - b.moduleIndex
      )
      .map((fragment) => fragment.code)
    rendered[slot] = [...new Set(code)].join('\n')
  }
  return rendered
}
