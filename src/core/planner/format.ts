import * as prettier from 'prettier'

import type { PlannedFile } from '../../types/plan'

/** Files the generated project never formats (git hooks are shell scripts without an extension). */
const UNFORMATTED_PREFIXES = ['.husky/']

function parseConfig(files: readonly PlannedFile[]): prettier.Options | undefined {
  const rc = files.find((file) => file.path === '.prettierrc')
  if (rc === undefined) {
    return undefined
  }
  return JSON.parse(rc.content) as prettier.Options
}

async function formatOne(file: PlannedFile, config: prettier.Options): Promise<PlannedFile> {
  if (UNFORMATTED_PREFIXES.some((prefix) => file.path.startsWith(prefix))) {
    return file
  }
  const { inferredParser } = await prettier.getFileInfo(file.path)
  if (inferredParser === null) {
    return file
  }
  const content = await prettier.format(file.content, { ...config, filepath: file.path })
  return content === file.content ? file : { ...file, content }
}

/**
 * Formats every planned file with the generated project's own Prettier config (D-48), so the
 * project passes `prettier --check` on its first run. Projects without Prettier are left as-is.
 */
export async function formatPlannedFiles(files: readonly PlannedFile[]): Promise<PlannedFile[]> {
  const config = parseConfig(files)
  if (config === undefined) {
    return [...files]
  }
  return formatWith(files, config)
}

/** Formats files with a given Prettier config, e.g. a project's own when `add` merges files. */
export function formatWith(
  files: readonly PlannedFile[],
  config: prettier.Options
): Promise<PlannedFile[]> {
  return Promise.all(files.map((file) => formatOne(file, config)))
}

/** The Prettier config a plan writes (its `.prettierrc`), if the project has Prettier. */
export const prettierConfigOf = (files: readonly PlannedFile[]): prettier.Options | undefined =>
  parseConfig(files)
