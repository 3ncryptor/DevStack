import { describe, expect, it } from 'vitest'

import { NODE_CATALOG, type CatalogName } from '../src/catalog/node'
import { composeModules } from '../src/core/composer'
import { loadModules } from '../src/core/module-loader'
import type { DevstackModule } from '../src/types/module'
import { testModule } from './helpers/modules'

function createModuleRegistry(modules: DevstackModule[]): Map<string, DevstackModule> {
  return new Map(modules.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]))
}

describe('composer', () => {
  it('includes required modules and keeps dependency order', () => {
    const registry = loadModules()

    const result = composeModules(['framework-express'], registry, 'test-app')
    const moduleNames = result.orderedModules.map((moduleDefinition) => moduleDefinition.id)

    expect(moduleNames).toEqual(['language-node', 'core-backend', 'framework-express'])
  })

  it('supports nest framework composition', () => {
    const registry = loadModules()

    const result = composeModules(['framework-nest'], registry, 'nest-app')
    const moduleNames = result.orderedModules.map((moduleDefinition) => moduleDefinition.id)

    expect(moduleNames).toEqual(['language-node', 'core-backend', 'framework-nest'])
    expect(result.packageJson.dependencies?.['@nestjs/core']).toBeDefined()
  })

  it('supports middleware modules with nest', () => {
    const registry = loadModules()

    const result = composeModules(
      ['framework-nest', 'middleware-cors', 'security-helmet', 'security-rate-limit'],
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
      ['framework-express', 'quality-eslint', 'quality-husky'],
      registry,
      'app-with-husky'
    )
    expect(withHusky.packageJson.scripts?.prepare).toBe('husky')
    expect(withHusky.packageJson.devDependencies?.husky).toBeDefined()
  })

  it('merges dependencies and scripts from selected modules', () => {
    const registry = loadModules()

    const result = composeModules(
      ['framework-express', 'orm-prisma', 'quality-prettier'],
      registry,
      'api-app'
    )

    expect(result.packageJson.dependencies?.express).toBeDefined()
    expect(result.packageJson.dependencies?.['@prisma/client']).toBeDefined()
    expect(result.packageJson.devDependencies?.typescript).toBeDefined()
    expect(result.packageJson.scripts?.['db:generate']).toBe('prisma generate')
    expect(result.packageJson.scripts?.format).toBe('prettier . --check')
  })

  it('takes every version from the catalog', () => {
    const result = composeModules(['framework-express'], loadModules(), 'catalog-app')

    expect(result.packageJson.dependencies?.express).toBe(NODE_CATALOG.express.version)
    expect(result.packageJson.devDependencies?.typescript).toBe(NODE_CATALOG.typescript.version)
  })

  it('adds the paired @types package when a module only lists the runtime package', () => {
    const registry = createModuleRegistry([
      testModule({ id: 'uses-express', dependencies: ['express'] })
    ])

    const result = composeModules(['uses-express'], registry, 'pair-app')

    expect(result.packageJson.devDependencies?.['@types/express']).toBe(
      NODE_CATALOG['@types/express'].version
    )
  })

  it('rejects a package that is not in the catalog', () => {
    const registry = createModuleRegistry([
      testModule({
        id: 'rogue',
        dependencies: ['left-pad-9000' as CatalogName]
      })
    ])

    expect(() => composeModules(['rogue'], registry, 'rogue-app')).toThrow(
      'Module "rogue" depends on "left-pad-9000", which is not in the version catalog'
    )
  })

  it('lists the install scripts pnpm has to approve for the selected stack', () => {
    const result = composeModules(['framework-express', 'orm-prisma'], loadModules(), 'build-app')

    expect(result.buildApprovals).toEqual([
      '@prisma/client',
      '@prisma/engines',
      'esbuild',
      'prisma'
    ])
  })
})
