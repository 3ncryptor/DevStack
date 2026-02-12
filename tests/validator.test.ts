import { describe, expect, it } from 'vitest'

import { validateModuleSelection } from '../src/core/validator'
import type { DevstackModule } from '../src/types/module'

describe('validator', () => {
  it('throws when conflicting modules are selected', () => {
    const modules: DevstackModule[] = [
      {
        name: 'folder-clean',
        description: 'clean',
        conflictsWith: ['folder-mvc']
      },
      {
        name: 'folder-mvc',
        description: 'mvc',
        conflictsWith: ['folder-clean']
      }
    ]

    expect(() => validateModuleSelection(modules)).toThrow('conflicts')
  })

  it('throws when required module is missing', () => {
    const modules: DevstackModule[] = [
      {
        name: 'framework-express',
        description: 'express',
        requires: ['language-node']
      }
    ]

    expect(() => validateModuleSelection(modules)).toThrow('requires')
  })

  it('throws when requiresAny condition is not satisfied', () => {
    const modules: DevstackModule[] = [
      {
        name: 'middleware-cors',
        description: 'cors',
        requiresAny: ['framework-express', 'framework-nest']
      }
    ]

    expect(() => validateModuleSelection(modules)).toThrow('requires one of')
  })
})
