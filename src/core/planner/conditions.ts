import type { Condition, DevstackModule, Depth } from '../../types/module'

/** What a condition is evaluated against (buildPlan B4): the resolved stack, seen from one module. */
export interface ConditionContext {
  /** Ids and capability tags of every selected module. */
  present: ReadonlySet<string>
  /** Id of the selected framework, if any. */
  framework: string | undefined
  /** Resolved options of the module the condition belongs to. */
  options: Readonly<Record<string, unknown>>
  depth: Depth
  /** Role of the target a file is rendered for; unset for slots and scripts. */
  target?: string
}

export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  if ('all' in condition) return condition.all.every((part) => evaluateCondition(part, context))
  if ('any' in condition) return condition.any.some((part) => evaluateCondition(part, context))
  if ('not' in condition) return !evaluateCondition(condition.not, context)
  if ('has' in condition) return context.present.has(condition.has)
  if ('framework' in condition) return context.framework === condition.framework
  if ('option' in condition) return Object.is(context.options[condition.option], condition.equals)
  if ('target' in condition) return context.target === condition.target
  return context.depth === condition.depth
}

const DEPTH_RANK: Record<Depth, number> = { bare: 0, wired: 1 }

/** A contribution appears at its depth and above (buildPlan B4): bare items at every depth. */
export function includedAtDepth(contribution: Depth, project: Depth): boolean {
  return DEPTH_RANK[contribution] <= DEPTH_RANK[project]
}

/** Module contributions default to `wired`; tooling modules declare `depth: 'bare'`. */
export function moduleDepth(moduleDefinition: DevstackModule): Depth {
  return moduleDefinition.depth ?? 'wired'
}

/** Builds the context for one module's conditions from the resolved stack. */
export function conditionContextFor(
  modules: readonly DevstackModule[],
  options: Readonly<Record<string, unknown>>,
  depth: Depth
): ConditionContext {
  return {
    present: new Set(
      modules.flatMap((moduleDefinition) => [
        moduleDefinition.id,
        ...(moduleDefinition.provides ?? [])
      ])
    ),
    framework: modules.find((moduleDefinition) => moduleDefinition.category === 'framework')?.id,
    options,
    depth
  }
}
