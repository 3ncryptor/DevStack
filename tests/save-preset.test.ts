import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { loadStackConfig } from '../src/intake/config'
import { saveStackPreset } from '../src/intake/save-preset'
import { InputError } from '../src/errors'
import type { StackDraft } from '../src/prompts/wizard/index'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)

const DRAFT: StackDraft = {
  projectName: 'demo-app',
  modules: ['language-node', 'framework-express'],
  packageManager: 'pnpm',
  depth: 'wired'
}

describe('saveStackPreset', () => {
  it('writes a stack config that --config can load', async () => {
    const dir = await tempDir('devstack-preset-')

    const written = await saveStackPreset(dir, 'demo.stack.json', DRAFT)
    const loaded = await loadStackConfig(written)

    expect(written).toBe(path.join(dir, 'demo.stack.json'))
    expect(loaded).toEqual({
      version: 1,
      name: 'demo-app',
      packageManager: 'pnpm',
      modules: ['language-node', 'framework-express'],
      depth: 'wired'
    })
  })

  it('never overwrites an existing file', async () => {
    const dir = await tempDir('devstack-preset-')
    await writeFile(path.join(dir, 'taken.json'), 'mine\n')

    await expect(saveStackPreset(dir, 'taken.json', DRAFT)).rejects.toThrow(/already exists/)
    expect(await readFile(path.join(dir, 'taken.json'), 'utf8')).toBe('mine\n')
  })

  it('explains a missing folder instead of failing with ENOENT', async () => {
    const dir = await tempDir('devstack-preset-')

    await expect(saveStackPreset(dir, 'missing/demo.json', DRAFT)).rejects.toThrow(
      /folder .*does not exist/
    )
  })

  it.each(['../outside.json', '/tmp/absolute.json'])(
    'refuses %s outside the folder',
    async (name) => {
      const dir = await tempDir('devstack-preset-')

      await expect(saveStackPreset(dir, name, DRAFT)).rejects.toThrow(InputError)
    }
  )
})
