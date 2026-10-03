import { describe, expect, it } from 'vitest'

import {
  conditionContextFor,
  evaluateCondition,
  includedAtDepth,
  type ConditionContext
} from '../src/core/planner/conditions'
import { testModule } from './helpers/modules'

const context: ConditionContext = {
  present: new Set(['language-node', 'framework-express', 'http-framework']),
  framework: 'framework-express',
  options: { limit: 100 },
  depth: 'wired',
  moduleSystem: 'esm'
}

describe('evaluateCondition', () => {
  it.each([
    [{ has: 'framework-express' }, true],
    [{ has: 'http-framework' }, true],
    [{ has: 'orm-prisma' }, false],
    [{ framework: 'framework-express' }, true],
    [{ framework: 'framework-nest' }, false],
    [{ option: 'limit', equals: 100 }, true],
    [{ option: 'limit', equals: 5 }, false],
    [{ depth: 'wired' }, true],
    [{ depth: 'bare' }, false],
    [{ moduleSystem: 'esm' }, true],
    [{ moduleSystem: 'cjs' }, false],
    [{ not: { has: 'orm-prisma' } }, true],
    [{ all: [{ has: 'http-framework' }, { depth: 'wired' }] }, true],
    [{ all: [{ has: 'http-framework' }, { depth: 'bare' }] }, false],
    [{ any: [{ has: 'orm-prisma' }, { framework: 'framework-express' }] }, true],
    [{ any: [] }, false],
    [{ all: [] }, true]
  ] as const)('%j is %s', (condition, expected) => {
    expect(evaluateCondition(condition, context)).toBe(expected)
  })
})

describe('conditionContextFor', () => {
  it("takes the API's framework, whichever framework the stack lists first", () => {
    const nextjs = testModule({ id: 'framework-nextjs', category: 'framework' })
    const express = testModule({
      id: 'framework-express',
      category: 'framework',
      provides: ['http-framework']
    })

    const context = conditionContextFor([nextjs, express], {}, 'wired', 'esm')

    expect(context.framework).toBe('framework-express')
  })
})

describe('includedAtDepth', () => {
  it('shows bare contributions at every depth and wired ones only when wired', () => {
    expect(includedAtDepth('bare', 'bare')).toBe(true)
    expect(includedAtDepth('bare', 'wired')).toBe(true)
    expect(includedAtDepth('wired', 'wired')).toBe(true)
    expect(includedAtDepth('wired', 'bare')).toBe(false)
  })
})
