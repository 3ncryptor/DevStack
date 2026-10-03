import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { DevstackModule } from '../../types/module'
import type { PlannedFile } from '../../types/plan'
import { renderTemplate, TEMPLATE_SUFFIX, type TemplateContext } from './templates'

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

/** Copies a template verbatim, or renders it with Eta when it ends in `.eta` (D-10). */
async function readTemplate(
  root: string,
  relativePath: string,
  context: TemplateContext
): Promise<Pick<PlannedFile, 'path' | 'content'>> {
  const source = await readTextTemplate(path.join(root, relativePath))
  if (!relativePath.endsWith(TEMPLATE_SUFFIX)) {
    return { path: toProjectRelativePath(relativePath), content: source }
  }
  const outputPath = toProjectRelativePath(relativePath.slice(0, -TEMPLATE_SUFFIX.length))
  return { path: outputPath, content: renderTemplate(source, context, relativePath) }
}

/** Where a template lands in the project: dotfile restored, `.eta` suffix removed. */
export function templateOutputPath(relativePath: string): string {
  const withoutSuffix = relativePath.endsWith(TEMPLATE_SUFFIX)
    ? relativePath.slice(0, -TEMPLATE_SUFFIX.length)
    : relativePath
  return toProjectRelativePath(withoutSuffix)
}

/** Path tokens a template path may contain (B6), replaced from the template context. */
export function resolvePathTokens(
  projectPath: string,
  context: Pick<TemplateContext, 'domainsDir'> & Partial<Pick<TemplateContext, 'apps'>>
): string {
  const resolved = projectPath.replaceAll('__domains__', context.domainsDir)
  // __api__: the API's folder in a monorepo (apps/api by default, task 5.3)
  return context.apps === undefined
    ? resolved
    : resolved.replaceAll('__api__', context.apps.backend.dir)
}

/** Reads a module's template directory into planned files. */
export async function moduleTemplateFiles(
  moduleDefinition: DevstackModule,
  sharedContext: Omit<TemplateContext, 'options'>,
  options: Record<string, unknown> = {},
  include: (outputPath: string) => boolean = () => true
): Promise<PlannedFile[]> {
  const context: TemplateContext = { ...sharedContext, options }
  if (moduleDefinition.filesPath === undefined) {
    return []
  }
  const root = moduleDefinition.filesPath
  const relativePaths = (await listFiles(root)).filter((relativePath) =>
    include(templateOutputPath(relativePath))
  )
  return Promise.all(
    relativePaths.map(async (relativePath) => {
      const template = await readTemplate(root, relativePath, context)
      return {
        ...template,
        path: resolvePathTokens(template.path, context),
        mode: FILE_MODE,
        strategy: 'create' as const,
        source: moduleDefinition.id
      }
    })
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
