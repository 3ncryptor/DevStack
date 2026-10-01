import { describe, expect, it } from 'vitest'

import { composeModules } from '../src/core/composer'
import { loadModules } from '../src/core/module-loader'
import { getPreset } from '../src/core/presets'
import { applyFixAction, resolveStack, type Diagnostic } from '../src/core/resolver/index'
import { ResolutionError } from '../src/errors'
import type { DevstackModule } from '../src/types/module'
import { testModule } from './helpers/modules'

function registryOf(modules: DevstackModule[]): Map<string, DevstackModule> {
  return new Map(modules.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]))
}

const codes = (diagnostics: readonly Diagnostic[]): string[] =>
  diagnostics.map((diagnostic) => diagnostic.code).sort()

const ids = (modules: readonly DevstackModule[]): string[] =>
  modules.map((moduleDefinition) => moduleDefinition.id)

describe('resolveStack with the built-in modules', () => {
  const registry = loadModules()
  const backend = [...(getPreset('backend')?.modules ?? [])]

  it('resolves the backend preset without diagnostics', () => {
    const result = resolveStack(backend, registry)

    expect(result.diagnostics).toEqual([])
    expect(ids(result.modules)[0]).toBe('language-node')
  })

  it('orders modules the same way whatever order they were selected in (principle 5)', () => {
    const forward = resolveStack(backend, registry)
    const backward = resolveStack([...backend].reverse(), registry)

    expect(ids(backward.modules)).toEqual(ids(forward.modules))
  })

  it('pulls in required modules', () => {
    expect(ids(resolveStack(['framework-express'], registry).modules)).toEqual([
      'language-node',
      'framework-express'
    ])
  })

  it('reports every problem in one pass, each with a fix', () => {
    const result = resolveStack(
      ['framework-express', 'framework-nest', 'arch-clean', 'arch-mvc', 'framework-expres'],
      registry
    )

    expect(codes(result.diagnostics)).toEqual(['single-select', 'single-select', 'unknown-module'])
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.severity).toBe('error')
      expect(diagnostic.fix).toBeTypeOf('string')
    }
  })

  it('suggests the closest module for a typo', () => {
    const [diagnostic] = resolveStack(['framework-expres'], registry).diagnostics

    expect(diagnostic?.fix).toContain('framework-express')
  })

  it('lists the modules that provide a missing capability', () => {
    const [diagnostic] = resolveStack(['security-helmet'], registry).diagnostics

    expect(diagnostic?.code).toBe('unmet-requirement')
    expect(diagnostic?.fix).toContain('framework-express')
    expect(diagnostic?.fix).toContain('framework-nest')
  })

  it('accepts old module ids through the alias table', () => {
    const result = resolveStack(['framework-express', 'folder-mvc'], registry)

    expect(result.diagnostics).toEqual([])
    expect(ids(result.modules)).toContain('arch-mvc')
  })
})

describe('resolveStack rules', () => {
  const base = testModule({ id: 'language-demo', category: 'language' })

  it('matches requirements against capability tags as well as ids', () => {
    const registry = registryOf([
      base,
      testModule({ id: 'framework-a', category: 'framework', provides: ['http-framework'] }),
      testModule({ id: 'middleware-x', requiresAny: ['http-framework'] })
    ])

    expect(resolveStack(['framework-a', 'middleware-x'], registry).diagnostics).toEqual([])
    expect(codes(resolveStack(['middleware-x'], registry).diagnostics)).toEqual([
      'unmet-requirement'
    ])
  })

  it('reports conflicts declared by id or tag', () => {
    const registry = registryOf([
      testModule({ id: 'misc-a', provides: ['cache'] }),
      testModule({ id: 'misc-b', conflictsWith: ['cache'] })
    ])

    expect(codes(resolveStack(['misc-a', 'misc-b'], registry).diagnostics)).toEqual(['conflict'])
  })

  it('reports a requirement cycle instead of looping', () => {
    const registry = registryOf([
      testModule({ id: 'misc-a', requires: ['misc-b'] }),
      testModule({ id: 'misc-b', requires: ['misc-a'] })
    ])

    expect(codes(resolveStack(['misc-a'], registry).diagnostics)).toEqual(['cycle'])
  })

  it('reports code for a slot no selected module exposes', () => {
    const registry = registryOf([
      testModule({ id: 'framework-a', category: 'framework', exposesSlots: ['app.middleware'] }),
      testModule({ id: 'misc-x', slots: [{ slot: 'app.routes', code: 'routes()' }] })
    ])

    expect(codes(resolveStack(['framework-a', 'misc-x'], registry).diagnostics)).toEqual([
      'unknown-slot'
    ])
  })

  it('reports packages missing from the version catalog', () => {
    const registry = registryOf([
      testModule({ id: 'misc-x', dependencies: ['left-pad-9000' as never] })
    ])

    expect(codes(resolveStack(['misc-x'], registry).diagnostics)).toEqual(['unknown-package'])
  })
})

describe('composeModules', () => {
  it('throws one ResolutionError carrying every diagnostic', () => {
    let caught: unknown
    try {
      composeModules(
        ['framework-express', 'framework-nest', 'arch-clean', 'arch-mvc'],
        loadModules(),
        'x'
      )
    } catch (error: unknown) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ResolutionError)
    const error = caught as ResolutionError
    expect(error.diagnostics).toHaveLength(2)
    expect(error.message).toContain('framework')
    expect(error.message).toContain('architecture')
  })
})

describe('diagnostic fix actions', () => {
  const registry = loadModules()

  it('offers adding each provider of a missing capability', () => {
    const [diagnostic] = resolveStack(['security-helmet'], registry).diagnostics

    expect(diagnostic?.actions).toEqual([
      { label: 'Add framework-express', add: ['framework-express'], remove: [] },
      { label: 'Add framework-nest', add: ['framework-nest'], remove: [] }
    ])
  })

  it('offers keeping each module of a single-select category', () => {
    const [diagnostic] = resolveStack(['framework-express', 'framework-nest'], registry).diagnostics

    expect(diagnostic?.actions).toEqual([
      { label: 'Keep framework-express', add: [], remove: ['framework-nest'] },
      { label: 'Keep framework-nest', add: [], remove: ['framework-express'] }
    ])
  })

  it('offers removing either side of a conflict', () => {
    const conflicting = registryOf([
      testModule({ id: 'a', conflictsWith: ['b'] }),
      testModule({ id: 'b' })
    ])
    const [diagnostic] = resolveStack(['a', 'b'], conflicting).diagnostics

    expect(diagnostic?.actions).toEqual([
      { label: 'Remove a', add: [], remove: ['a'] },
      { label: 'Remove b', add: [], remove: ['b'] }
    ])
  })

  it('applies an action and resolves cleanly afterwards', () => {
    const [diagnostic] = resolveStack(['security-helmet'], registry).diagnostics
    const action = diagnostic?.actions?.[0]
    const fixed = action === undefined ? [] : applyFixAction(['security-helmet'], action)

    expect(fixed).toEqual(['security-helmet', 'framework-express'])
    expect(resolveStack(fixed, registry).diagnostics).toEqual([])
  })
})
