import { describe, expect, it } from 'vitest'

import { composeModules } from '../src/core/composer'
import { loadModules } from '../src/core/module-loader'
import type { DevstackModule } from '../src/types/module'

function createModuleRegistry(modules: DevstackModule[]): Map<string, DevstackModule> {
  return new Map(modules.map((moduleDefinition) => [moduleDefinition.name, moduleDefinition]))
}

describe('composer', () => {
  it('includes required modules and keeps dependency order', () => {
    const registry = loadModules()

    const result = composeModules(['framework-express'], registry, 'test-app')
    const moduleNames = result.orderedModules.map((moduleDefinition) => moduleDefinition.name)

    expect(moduleNames).toEqual(['language-node', 'framework-express'])
  })

  it('supports nest framework composition', () => {
    const registry = loadModules()

    const result = composeModules(['framework-nest'], registry, 'nest-app')
    const moduleNames = result.orderedModules.map((moduleDefinition) => moduleDefinition.name)

    expect(moduleNames).toEqual(['language-node', 'framework-nest'])
    expect(result.packageJson.dependencies?.['@nestjs/core']).toBeDefined()
  })

  it('supports middleware modules with nest', () => {
    const registry = loadModules()

    const result = composeModules(
      ['framework-nest', 'middleware-cors', 'security-helmet', 'rate-limit'],
      registry,
      'nest-api'
    )

    expect(result.packageJson.dependencies?.cors).toBeDefined()
    expect(result.packageJson.dependencies?.helmet).toBeDefined()
    expect(result.packageJson.dependencies?.['express-rate-limit']).toBeDefined()
  })

  it('adds husky scripts only when quality-husky is selected', () => {
    const registry = loadModules()

    const withoutHusky = composeModules(['framework-express'], registry, 'app-no-husky')
    expect(withoutHusky.packageJson.scripts?.prepare).toBeUndefined()

    const withHusky = composeModules(
      ['framework-express', 'linter-eslint', 'quality-husky'],
      registry,
      'app-with-husky'
    )
    expect(withHusky.packageJson.scripts?.prepare).toBe('husky')
    expect(withHusky.packageJson.devDependencies?.husky).toBeDefined()
  })

  it('merges dependencies and scripts from selected modules', () => {
    const registry = loadModules()

    const result = composeModules(
      ['framework-express', 'orm-prisma', 'formatter-prettier'],
      registry,
      'api-app'
    )

    expect(result.packageJson.dependencies?.express).toBeDefined()
    expect(result.packageJson.dependencies?.['@prisma/client']).toBeDefined()
    expect(result.packageJson.devDependencies?.typescript).toBeDefined()
    expect(result.packageJson.scripts?.['prisma:generate']).toBe('prisma generate')
    expect(result.packageJson.scripts?.format).toBe('prettier . --check')
  })

  it('throws when dependency versions conflict', () => {
    const registry = createModuleRegistry([
      {
        name: 'a',
        description: 'module a',
        dependencies: { express: '^4.0.0' }
      },
      {
        name: 'b',
        description: 'module b',
        dependencies: { express: '^5.0.0' }
      }
    ])

    expect(() => composeModules(['a', 'b'], registry, 'conflict-app')).toThrow(
      'Dependency version conflict'
    )
  })
})
