import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { parseStackConfig, type StackConfig } from '../core/manifest'
import { InputError } from '../errors'

/** Reads and validates a stack config file (`--config`), with messages that name the file. */
export async function loadStackConfig(file: string): Promise<StackConfig> {
  const shown = path.relative(process.cwd(), file) || file
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code
    const reason = code === 'ENOENT' ? 'not found' : `unreadable (${String(code)})`
    throw new InputError(`Config file ${shown} ${reason}.`, { cause: error })
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new InputError(`Config file ${shown} is not valid JSON: ${reason}`, { cause: error })
  }
  return parseStackConfig(raw, shown)
}
