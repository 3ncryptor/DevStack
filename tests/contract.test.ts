import { describe, expect, it } from 'vitest'

import { composeModules } from '../src/core/composer'
import { loadModules } from '../src/core/module-loader'
import { canonicalModuleId, MODULE_ALIASES } from '../src/modules/aliases'
import { BUILTIN_MODULES } from '../src/modules/index'
import type { ModuleCategory } from '../src/types/module'

/** Id prefixes allowed for each category in use (buildPlan B4: ids are category-prefixed). */
const PREFIXES: Partial<Record<ModuleCategory, readonly string[]>> = {
  language: ['language-'],
  framework: ['framework-'],
  orm: ['orm-'],
  architecture: ['arch-'],
  quality: ['quality-'],
  middleware: ['middleware-'],
  security: ['security-'],
  devops: ['devops-'],
  // baselines every framework requires; never selected on their own
  misc: ['core-']
}

describe('module contract v2', () => {
  it.each(BUILTIN_MODULES.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]))(
    '%s has a category-prefixed id and a title',
    (_id, moduleDefinition) => {
      const prefixes = PREFIXES[moduleDefinition.category] ?? []

      expect(prefixes.some((prefix) => moduleDefinition.id.startsWith(prefix))).toBe(true)
      expect(moduleDefinition.title.trim()).not.toBe('')
    }
  )

  it('only references modules or capability tags that exist', () => {
    const ids = new Set([
      ...BUILTIN_MODULES.map((moduleDefinition) => moduleDefinition.id),
      ...BUILTIN_MODULES.flatMap((moduleDefinition) => moduleDefinition.provides ?? [])
    ])
    const dangling = BUILTIN_MODULES.flatMap((moduleDefinition) =>
      [
        ...(moduleDefinition.requires ?? []),
        ...(moduleDefinition.requiresAny ?? []),
        ...(moduleDefinition.conflictsWith ?? [])
      ]
        .filter((reference) => !ids.has(reference))
        .map((reference) => `${moduleDefinition.id} -> ${reference}`)
    )

    expect(dangling).toEqual([])
  })
})

describe('module aliases', () => {
  const ids = new Set(BUILTIN_MODULES.map((moduleDefinition) => moduleDefinition.id))

  it('point at existing modules and never shadow a live id', () => {
    for (const [oldId, newId] of Object.entries(MODULE_ALIASES)) {
      expect(ids.has(newId)).toBe(true)
      expect(ids.has(oldId)).toBe(false)
    }
  })

  it('resolve an old id to the renamed module during composition', () => {
    const result = composeModules(['framework-express', 'folder-mvc'], loadModules(), 'alias-app')

    expect(canonicalModuleId('folder-mvc')).toBe('arch-mvc')
    expect(result.orderedModules.map((moduleDefinition) => moduleDefinition.id)).toContain(
      'arch-mvc'
    )
  })
})
