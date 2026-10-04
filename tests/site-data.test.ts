import { describe, expect, it } from 'vitest'

import { GATES } from '../src/core/finish/verify'
import { loadModules } from '../src/core/module-loader'
import { PRESETS } from '../src/core/presets'
import { resolveStack } from '../src/core/resolver/index'
import { BUILTIN_MODULES } from '../src/modules/registry'
import { filmData, siteModules } from '../src/site-data'
import type { DevstackModule } from '../src/types/module'

/** The website's modules exactly as it receives them: through JSON. */
const fromJson = new Map(
  (JSON.parse(JSON.stringify(siteModules(BUILTIN_MODULES))) as DevstackModule[]).map(
    (moduleDefinition) => [moduleDefinition.id, moduleDefinition]
  )
)
const registry = new Map(
  BUILTIN_MODULES.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition])
)

const resolved = (modules: Map<string, DevstackModule>, ids: readonly string[]) => {
  const result = resolveStack([...ids], modules)
  return {
    modules: result.modules.map((moduleDefinition) => moduleDefinition.id),
    diagnostics: result.diagnostics.map((diagnostic) => diagnostic.message)
  }
}

describe('site data (D-99)', () => {
  it.each(Object.keys(PRESETS))('resolves the %s preset exactly like the registry', (name) => {
    const ids = PRESETS[name]?.modules ?? []

    expect(resolved(fromJson, ids)).toEqual(resolved(registry, ids))
  })

  it('reports a broken stack the same way', () => {
    const broken = ['orm-mongoose', 'database-postgres', 'framework-express', 'framework-nest']

    expect(resolved(fromJson, broken)).toEqual(resolved(registry, broken))
  })

  it('films a real stack: wizard answers, planned files and the checks', async () => {
    const film = await filmData(loadModules())

    expect(film.answers).toContainEqual({ question: 'Framework', answer: 'Express' })
    expect(film.files).toContain('.devstack/stack.json')
    expect(film.gates).toEqual(GATES)
  })

  it('keeps option defaults and choices for the builder, and no template paths', () => {
    const rateLimit = fromJson.get('security-rate-limit') as unknown as Record<string, unknown>

    expect(rateLimit['filesPath']).toBeUndefined()
    expect(JSON.stringify(rateLimit['optionsSchema'])).toContain('"default":"fixed-window"')
  })
})
