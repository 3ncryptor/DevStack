import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'

describe('module-loader', () => {
  it('loads builtin modules', () => {
    const modules = loadModules()

    expect(modules.size).toBeGreaterThanOrEqual(16)
    expect(modules.has('language-node')).toBe(true)
    expect(modules.has('framework-express')).toBe(true)
    expect(modules.has('framework-nest')).toBe(true)
    expect(modules.has('orm-prisma')).toBe(true)
    expect(modules.has('security-rate-limit')).toBe(true)
    expect(modules.has('quality-husky')).toBe(true)
    expect(modules.has('middleware-cors')).toBe(true)
    expect(modules.has('security-helmet')).toBe(true)
    expect(modules.has('security-origin-checks')).toBe(true)
  })
})
