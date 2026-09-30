import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { BUILTIN_MODULES } from '../src/modules/index'

describe('module template paths', () => {
  it('resolves an existing files directory for every module that declares one', () => {
    const missing = BUILTIN_MODULES.filter(
      (moduleDefinition) =>
        moduleDefinition.filesPath !== undefined && !existsSync(moduleDefinition.filesPath)
    ).map((moduleDefinition) => moduleDefinition.name)

    expect(missing).toEqual([])
  })
})
