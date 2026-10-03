import { readFileSync } from 'node:fs'
import path from 'node:path'

import { PACKAGE_ROOT } from '../../paths'
import type { PlannedFile } from '../../types/plan'
import type { ResolvedSettings } from '../settings'
import { generatedFile } from './files'

/** `strictest` (A6 layer 2): what `strict` leaves out and catches real bugs. */
const STRICTEST_OPTIONS = {
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true
} as const

const TSCONFIG = /(^|\/)tsconfig\.json$/

/**
 * Applies the TS strictness tier (task 5.2) to every tsconfig with `strict` on. A tsconfig that
 * does not parse as JSON is left alone: it is the module's own business.
 */
export function withStrictness(file: PlannedFile, settings: ResolvedSettings): PlannedFile {
  if (settings.strictness === 'standard' || !TSCONFIG.test(file.path)) return file
  let config: { compilerOptions?: Record<string, unknown> }
  try {
    config = JSON.parse(file.content) as typeof config
  } catch {
    return file
  }
  if (config.compilerOptions?.strict !== true) return file
  const strictest = {
    ...config,
    compilerOptions: { ...config.compilerOptions, ...STRICTEST_OPTIONS }
  }
  return { ...file, content: `${JSON.stringify(strictest, null, 2)}\n` }
}

/** .editorconfig from the code style, so every editor indents the way Prettier formats. */
export function editorConfig(settings: ResolvedSettings): PlannedFile {
  const { useTabs, tabWidth } = settings.style
  return generatedFile(
    '.editorconfig',
    [
      'root = true',
      '',
      '[*]',
      'charset = utf-8',
      'end_of_line = lf',
      'insert_final_newline = true',
      'trim_trailing_whitespace = true',
      `indent_style = ${useTabs ? 'tab' : 'space'}`,
      `indent_size = ${tabWidth}`,
      '',
      '[*.md]',
      'trim_trailing_whitespace = false',
      ''
    ].join('\n'),
    { strategy: 'skip-if-exists' }
  )
}

/**
 * LICENSE for an open-source license (task 5.3); UNLICENSED, the default for a private project,
 * writes none. The holder is the author, or the project name when there is none.
 */
export function licenseFile(
  settings: ResolvedSettings,
  projectName: string,
  year: number
): PlannedFile | undefined {
  if (settings.license === 'UNLICENSED') return undefined
  const text = readFileSync(
    path.join(PACKAGE_ROOT, 'src', 'licenses', `${settings.license}.txt`),
    'utf8'
  )
  return generatedFile(
    'LICENSE',
    text
      .replaceAll('{{year}}', String(year))
      .replaceAll('{{holder}}', settings.author ?? projectName),
    { strategy: 'skip-if-exists' }
  )
}

/** package.json metadata from the settings: description, author, license (task 5.3). */
export function packageMetadata(settings: ResolvedSettings): Record<string, string> {
  return {
    ...(settings.description === undefined ? {} : { description: settings.description }),
    ...(settings.author === undefined ? {} : { author: settings.author }),
    license: settings.license
  }
}
