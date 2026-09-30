import path from 'node:path'

import fs from 'fs-extra'

import type { GeneratorContext } from '../types/context'
import type { DevstackModule } from '../types/module'

type ConflictAction = 'overwrite' | 'skip' | 'overwrite-all' | 'skip-all'

async function collectFiles(rootPath: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const resolved = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(resolved)))
      continue
    }

    if (entry.isFile()) {
      files.push(resolved)
    }
  }

  return files
}

function askConflictAction(context: GeneratorContext, filePath: string): Promise<ConflictAction> {
  return context.prompter.select<ConflictAction>({
    message: `File already exists: ${filePath}`,
    choices: [
      { value: 'overwrite', label: 'Overwrite' },
      { value: 'skip', label: 'Skip' },
      { value: 'overwrite-all', label: 'Overwrite all' },
      { value: 'skip-all', label: 'Skip all' }
    ]
  })
}

/**
 * npm drops `.gitignore` from published packages, so templates store dotfiles that npm
 * would strip without the leading dot and they are restored here.
 */
const DOTFILE_TEMPLATES = new Set(['gitignore'])

export function toProjectRelativePath(templateRelativePath: string): string {
  const directory = path.dirname(templateRelativePath)
  const baseName = path.basename(templateRelativePath)
  if (!DOTFILE_TEMPLATES.has(baseName)) {
    return templateRelativePath
  }
  return directory === '.' ? `.${baseName}` : path.join(directory, `.${baseName}`)
}

export async function mergeModuleFiles(
  modules: DevstackModule[],
  context: GeneratorContext
): Promise<void> {
  let overwriteAll = context.options.yes
  let skipAll = false

  for (const moduleDefinition of modules) {
    if (!moduleDefinition.filesPath) {
      continue
    }

    const exists = await fs.pathExists(moduleDefinition.filesPath)
    if (!exists) {
      context.logger.warn(
        `Skipping files for module "${moduleDefinition.name}" because ${moduleDefinition.filesPath} does not exist`
      )
      continue
    }

    const moduleFiles = await collectFiles(moduleDefinition.filesPath)
    context.logger.debug(
      `Merging ${moduleFiles.length} files from module "${moduleDefinition.name}" into ${context.projectDir}`
    )

    for (const sourceFile of moduleFiles) {
      const relativePath = toProjectRelativePath(
        path.relative(moduleDefinition.filesPath, sourceFile)
      )
      const targetFile = path.join(context.projectDir, relativePath)
      const targetExists = await fs.pathExists(targetFile)

      if (targetExists) {
        if (skipAll) {
          continue
        }

        if (!overwriteAll) {
          const action = await askConflictAction(context, relativePath)
          if (action === 'skip') {
            continue
          }

          if (action === 'skip-all') {
            skipAll = true
            continue
          }

          if (action === 'overwrite-all') {
            overwriteAll = true
          }
        }
      }

      await fs.ensureDir(path.dirname(targetFile))
      await fs.copy(sourceFile, targetFile, { overwrite: true })
    }
  }
}
