/**
 * The release workflow's first gate (.github/workflows/release.yml, RELEASING.md):
 *
 *   npx tsx scripts/release-notes.ts v1.0.0
 *
 * Fails unless the tag is v<package.json version> and CHANGELOG.md (written by Changesets) has a
 * `## <version>` section; prints the section's body, which becomes the GitHub Release notes.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '..')

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function checkTag(tag: string, version: string): void {
  if (tag !== `v${version}`) {
    throw new Error(
      `tag ${tag} does not match package.json version ${version} (expected v${version})`
    )
  }
}

/** The body of `## <version>`, up to the next `## ` heading. */
export function releaseNotes(changelog: string, version: string): string {
  const lines = changelog.split('\n')
  const heading = new RegExp(`^## ${escapeRegExp(version)}\\s*$`)
  const start = lines.findIndex((line) => heading.test(line))
  if (start === -1) throw new Error(`CHANGELOG.md has no "## ${version}" section`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  if (body === '') throw new Error(`the CHANGELOG.md section for ${version} is empty`)
  return body
}

function main(): void {
  const tag = process.argv[2]
  if (tag === undefined) {
    process.stderr.write('usage: npx tsx scripts/release-notes.ts v<version>\n')
    process.exit(2)
  }
  try {
    const { version } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      version: string
    }
    checkTag(tag, version)
    const changelog = readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')
    process.stdout.write(`${releaseNotes(changelog, version)}\n`)
  } catch (error) {
    process.stderr.write(
      `release-notes: ${error instanceof Error ? error.message : String(error)}\n`
    )
    process.exit(1)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main()
