import path from 'node:path'

import fs from 'fs-extra'
import inquirer from 'inquirer'

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

async function askConflictAction(filePath: string): Promise<ConflictAction> {
  const answers = await inquirer.prompt<{ action: ConflictAction }>([
    {
      type: 'list',
      name: 'action',
      message: `File already exists: ${filePath}`,
      choices: [
        { name: 'Overwrite', value: 'overwrite' },
        { name: 'Skip', value: 'skip' },
        { name: 'Overwrite all', value: 'overwrite-all' },
        { name: 'Skip all', value: 'skip-all' }
      ]
    }
  ])

  return answers.action
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
      const relativePath = path.relative(moduleDefinition.filesPath, sourceFile)
      const targetFile = path.join(context.projectDir, relativePath)
      const targetExists = await fs.pathExists(targetFile)

      if (targetExists) {
        if (skipAll) {
          continue
        }

        if (!overwriteAll) {
          const action = await askConflictAction(relativePath)
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
