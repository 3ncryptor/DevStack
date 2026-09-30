import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { DevstackModule } from '../../types/module'
import type { PlannedFile } from '../../types/plan'

const FILE_MODE = 0o644
export const EXECUTABLE_MODE = 0o755

/**
 * npm drops `.gitignore` from published packages, so templates store dotfiles that npm would
 * strip without the leading dot and they are restored here.
 */
const DOTFILE_TEMPLATES = new Set(['gitignore'])

export function toProjectRelativePath(templateRelativePath: string): string {
  const posixPath = templateRelativePath.split(path.sep).join('/')
  const directory = path.posix.dirname(posixPath)
  const baseName = path.posix.basename(posixPath)
  if (!DOTFILE_TEMPLATES.has(baseName)) {
    return posixPath
  }
  return directory === '.' ? `.${baseName}` : `${directory}/.${baseName}`
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .sort()
}

/** Templates are text; a binary file would be corrupted by the UTF-8 plan, so refuse it. */
async function readTextTemplate(filePath: string): Promise<string> {
  const bytes = await readFile(filePath)
  if (bytes.includes(0)) {
    throw new Error(`Template ${filePath} looks binary; module templates must be text files.`)
  }
  return bytes.toString('utf8')
}

/** Reads a module's template directory into planned files. */
export async function moduleTemplateFiles(
  moduleDefinition: DevstackModule
): Promise<PlannedFile[]> {
  if (moduleDefinition.filesPath === undefined) {
    return []
  }
  const root = moduleDefinition.filesPath
  const relativePaths = await listFiles(root)
  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: toProjectRelativePath(relativePath),
      content: await readTextTemplate(path.join(root, relativePath)),
      mode: FILE_MODE,
      strategy: 'create' as const,
      source: moduleDefinition.name
    }))
  )
}

export function generatedFile(
  filePath: string,
  content: string,
  options: Partial<Pick<PlannedFile, 'mode' | 'strategy'>> = {}
): PlannedFile {
  return {
    path: filePath,
    content,
    mode: options.mode ?? FILE_MODE,
    strategy: options.strategy ?? 'create',
    source: 'devstack'
  }
}
