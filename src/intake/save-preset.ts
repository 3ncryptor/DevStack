import { writeFile } from 'node:fs/promises'

import { parseStackConfig, STACK_CONFIG_VERSION } from '../core/manifest'
import { resolveInside } from '../core/project-name'
import { InputError } from '../errors'
import type { StackDraft } from '../prompts/wizard/review'

const errorCode = (error: unknown): unknown =>
  error instanceof Error && 'code' in error ? error.code : undefined

/**
 * "Save as preset" on the review screen: writes the stack as a config file in `dir`, readable
 * with --config. It only ever creates a new file inside `dir`; an existing file is left alone.
 */
export async function saveStackPreset(
  dir: string,
  fileName: string,
  draft: StackDraft
): Promise<string> {
  const target = resolveInside(dir, fileName)
  const config = parseStackConfig(
    {
      version: STACK_CONFIG_VERSION,
      name: draft.projectName,
      packageManager: draft.packageManager,
      // modules with options are written as { id, options }, so a replay keeps them
      modules: draft.modules.map((id) => {
        const options = draft.moduleOptions?.[id]
        return options === undefined ? id : { id, options }
      }),
      depth: draft.depth
    },
    fileName
  )
  try {
    await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' })
  } catch (error: unknown) {
    if (errorCode(error) === 'EEXIST') {
      throw new InputError(`${fileName} already exists; choose another name.`, { cause: error })
    }
    if (errorCode(error) === 'ENOENT') {
      throw new InputError(
        `The folder for ${fileName} does not exist; choose a name in an existing folder.`,
        { cause: error }
      )
    }
    throw error
  }
  return target
}
