import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { evaluateCondition, type ConditionContext } from '../src/core/planner/conditions'
import { getPreset } from '../src/core/presets'
import { resolveStack } from '../src/core/resolver/index'
import { BUILTIN_MODULES } from '../src/modules/index'
import { PACKAGE_ROOT } from '../src/paths'
import type { Condition } from '../src/types/module'
import { moduleIdOf, parseMatrix } from './e2e/lib/checks'

/** Every leaf condition (`has`, `framework`, `depth`, ...) inside a condition tree. */
function atoms(condition: Condition): Condition[] {
  if ('all' in condition) return condition.all.flatMap(atoms)
  if ('any' in condition) return condition.any.flatMap(atoms)
  if ('not' in condition) return atoms(condition.not)
  return [condition]
}

const matrix = parseMatrix(
  JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'tests', 'e2e', 'matrix.json'), 'utf8'))
)
const registry = loadModules()

/** The context each e2e combination generates with. */
const combinations = matrix.map((combination) => {
  const requested =
    combination.preset !== undefined
      ? [...(getPreset(combination.preset)?.modules ?? [])]
      : (combination.modules ?? []).map(moduleIdOf)
  const modules = resolveStack(requested, registry).modules
  const context: ConditionContext = {
    present: new Set(
      modules.flatMap((moduleDefinition) => [
        moduleDefinition.id,
        ...(moduleDefinition.provides ?? [])
      ])
    ),
    framework: modules.find((moduleDefinition) => moduleDefinition.category === 'framework')?.id,
    options: {},
    depth: combination.depth ?? 'wired'
  }
  return { id: combination.id, context }
})

/** Every condition atom a module declares, with the module that declares it. */
const declared = BUILTIN_MODULES.flatMap((moduleDefinition) =>
  [
    ...(moduleDefinition.files ?? []).flatMap((rule) =>
      rule.when === undefined ? [] : atoms(rule.when)
    ),
    ...(moduleDefinition.slots ?? []).flatMap((fragment) =>
      fragment.when === undefined ? [] : atoms(fragment.when)
    )
  ].map((atom) => ({ owner: moduleDefinition.id, atom }))
)

describe('integration matrix coverage (buildPlan B13)', () => {
  it('declares at least one condition, so this check is not vacuous', () => {
    expect(declared.length).toBeGreaterThan(0)
  })

  it.each(declared.map((entry) => [entry.owner, JSON.stringify(entry.atom), entry]))(
    '%s: %s is exercised both ways by some e2e combination',
    (_owner, _atom, entry) => {
      const withOwner = combinations.filter((combination) =>
        combination.context.present.has(entry.owner)
      )
      const outcomes = new Set(
        withOwner.map((combination) => evaluateCondition(entry.atom, combination.context))
      )

      expect([...outcomes].sort()).toEqual([false, true])
    }
  )
})

describe('e2e smoke tier', () => {
  const smoke = matrix.filter((combination) => combination.smoke === true)
  const modulesOf = (combination: (typeof matrix)[number]): string[] =>
    combination.preset !== undefined
      ? [...(getPreset(combination.preset)?.modules ?? [])]
      : (combination.modules ?? []).map(moduleIdOf)

  it('stays small enough to run on every change', () => {
    expect(smoke.length).toBeGreaterThan(0)
    expect(smoke.length).toBeLessThanOrEqual(4)
  })

  it('still covers both frameworks, both depths, the monorepo, the web app and Docker', () => {
    const covered = new Set(smoke.flatMap(modulesOf))
    const depths = new Set(smoke.map((combination) => combination.depth ?? 'wired'))

    for (const id of [
      'framework-express',
      'framework-nest',
      'layout-monorepo',
      'framework-nextjs',
      'devops-docker'
    ]) {
      expect(covered).toContain(id)
    }
    expect([...depths].sort()).toEqual(['bare', 'wired'])
  })
})
