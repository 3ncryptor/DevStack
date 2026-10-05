/**
 * Writes dist/THIRD_PARTY_NOTICES.md: the licence of every package tsup bundles into dist/ (the
 * MCP SDK and its dependencies). Their licences (MIT, ISC, BSD) require the notice to travel
 * with the code; runtime dependencies install with their own. The list comes from esbuild's
 * metafile, so it follows whatever the bundle actually contains.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { Options } from 'tsup'

type Plugin = NonNullable<Options['esbuildPlugins']>[number]

const NOTICES_FILE = 'THIRD_PARTY_NOTICES.md'
const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i

interface BundledPackage {
  readonly name: string
  readonly version: string
  readonly license: string
  readonly text: string
}

/** The package folder an input like `node_modules/a/node_modules/b/dist/x.js` comes from. */
function packageRoot(input: string): string | undefined {
  const marker = 'node_modules/'
  const start = input.lastIndexOf(marker)
  if (start === -1) return undefined
  const rest = input.slice(start + marker.length).split('/')
  const depth = rest[0]?.startsWith('@') === true ? 2 : 1
  return input.slice(0, start + marker.length) + rest.slice(0, depth).join('/')
}

function readPackage(root: string): BundledPackage {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    name: string
    version: string
    license?: string
  }
  const licenseFile = readdirSync(root).find((file) => LICENSE_FILE.test(file))
  if (licenseFile === undefined) throw new Error(`${manifest.name}: no licence file to bundle`)
  return {
    name: manifest.name,
    version: manifest.version,
    license: manifest.license ?? 'see licence text',
    text: readFileSync(path.join(root, licenseFile), 'utf8').trim()
  }
}

function notices(packages: readonly BundledPackage[]): string {
  const sections = packages.map(
    ({ name, version, license, text }) => `## ${name}@${version} (${license})\n\n${text}\n`
  )
  return [
    '# Third-party notices',
    '',
    'This package bundles the following open-source packages into `dist/`.',
    '',
    ...sections
  ].join('\n')
}

/** An esbuild plugin for tsup: after each build, writes the notices next to the bundle. */
export function thirdPartyNotices(): Plugin {
  return {
    name: 'third-party-notices',
    setup(build) {
      build.initialOptions.metafile = true
      build.onEnd(({ metafile }) => {
        if (metafile === undefined) return
        const roots = new Set(
          Object.keys(metafile.inputs).flatMap((input) => packageRoot(input) ?? [])
        )
        const packages = [...roots]
          .map(readPackage)
          .sort((left, right) => left.name.localeCompare(right.name))
        // tsup writes the bundle itself after this hook, so on a clean checkout dist/ is not there yet
        const outdir = build.initialOptions.outdir ?? 'dist'
        mkdirSync(outdir, { recursive: true })
        writeFileSync(path.join(outdir, NOTICES_FILE), notices(packages))
      })
    }
  }
}
