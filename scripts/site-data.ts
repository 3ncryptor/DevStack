/**
 * Writes the module registry as JSON for the website (D-99): `tsx scripts/site-data.ts <file>`.
 * Run before the site's dev server and build, so the site always describes this checkout.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { BUILTIN_MODULES } from '../src/modules/registry'
import { siteModules } from '../src/site-data'

const target = process.argv[2]
if (target === undefined) throw new Error('usage: tsx scripts/site-data.ts <output.json>')

await mkdir(path.dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(siteModules(BUILTIN_MODULES))}\n`)
