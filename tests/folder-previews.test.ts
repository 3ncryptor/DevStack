import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PACKAGE_ROOT } from '../src/paths'
import { FOLDER_PREVIEWS, previewNote } from '../src/prompts/wizard/folder-previews'

/** Every folder a module's templates create, e.g. `src/features/`. */
async function templateFolders(id: string): Promise<Set<string>> {
  const root = path.join(PACKAGE_ROOT, 'src', 'modules', id, 'files')
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => [])
  return new Set(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => `${path.relative(root, entry.parentPath).split(path.sep).join('/')}/`)
  )
}

describe('folder-tree previews (task 3.8)', () => {
  it.each(Object.entries(FOLDER_PREVIEWS).filter(([id]) => id !== 'arch-flat'))(
    '%s previews only folders its templates create',
    async (id, folders) => {
      const created = await templateFolders(id)

      for (const folder of folders) {
        expect(created).toContain(folder.replace('<name>/', ''))
      }
    }
  )

  it('arch-flat creates no folders', async () => {
    expect((await templateFolders('arch-flat')).size).toBe(0)
  })

  it('shows one tree per choice, under its label', () => {
    expect(
      previewNote([
        { value: 'arch-clean', label: 'Clean architecture' },
        { value: 'none', label: 'Other' }
      ])
    ).toBe(
      'Clean architecture\n  src/domain/\n  src/application/\n  src/infrastructure/\n  src/interfaces/'
    )
  })
})
