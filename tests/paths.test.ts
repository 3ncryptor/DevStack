import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { toProjectRelativePath } from '../src/core/file-merger'
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

describe('toProjectRelativePath', () => {
  it('restores the dot on templates npm would strip', () => {
    expect(toProjectRelativePath('gitignore')).toBe('.gitignore')
    expect(toProjectRelativePath('apps/api/gitignore')).toBe('apps/api/.gitignore')
  })

  it('leaves every other path unchanged', () => {
    expect(toProjectRelativePath('src/app.ts')).toBe('src/app.ts')
    expect(toProjectRelativePath('.prettierrc')).toBe('.prettierrc')
  })
})
