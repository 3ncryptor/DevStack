import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The docs are DevStack's README (one source, so they cannot drift), read at build time and cut
 * into its `##` sections for the sidebar.
 */
const README = path.join(process.cwd(), '..', 'README.md')

export interface DocSection {
  readonly slug: string
  readonly title: string
  readonly markdown: string
}

/** Sections that are about developing DevStack itself, not using it. */
const LEFT_OUT = new Set(['Develop', 'License'])

export const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

/** The README's `##` sections in order, each with its `###` subsections. */
export function docSections(): DocSection[] {
  const sections = readFileSync(README, 'utf8').split(/^## /m).slice(1)
  return sections
    .map((section) => {
      const [title = '', ...body] = section.split('\n')
      return { slug: slugOf(title), title: title.trim(), markdown: body.join('\n').trim() }
    })
    .filter((section) => !LEFT_OUT.has(section.title))
}

/** One `###` subsection of the README by its title, e.g. the MCP setup. */
export function docSubsection(title: string): string {
  const [, after = ''] = readFileSync(README, 'utf8').split(`### ${title}\n`)
  return after.split(/^##+ /m)[0]?.trim() ?? ''
}
