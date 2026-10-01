import { describe, expect, it } from 'vitest'

import { validateModuleSelection } from '../src/core/validator'
import type { DevstackModule } from '../src/types/module'
import { testModule } from './helpers/modules'

describe('validator', () => {
  it('throws when conflicting modules are selected', () => {
    const modules: DevstackModule[] = [
      testModule({ id: 'arch-clean', conflictsWith: ['arch-mvc'] }),
      testModule({ id: 'arch-mvc', conflictsWith: ['arch-clean'] })
    ]

    expect(() => validateModuleSelection(modules)).toThrow('conflicts')
  })

  it('throws when required module is missing', () => {
    const modules: DevstackModule[] = [
      testModule({ id: 'framework-express', requires: ['language-node'] })
    ]

    expect(() => validateModuleSelection(modules)).toThrow('requires')
  })

  it('throws when requiresAny condition is not satisfied', () => {
    const modules: DevstackModule[] = [
      testModule({ id: 'middleware-cors', requiresAny: ['framework-express', 'framework-nest'] })
    ]

    expect(() => validateModuleSelection(modules)).toThrow('requires one of')
  })
})
