/**
 * Writes what the website reads from DevStack (D-99): `tsx scripts/site-data.ts <dir>` writes
 * modules.json (the registry) and film.json (the product film's stack, planned for real). Run
 * before the site's dev server, build and typecheck, so the site always describes this checkout.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { loadModules } from '../src/core/module-loader'
import { BUILTIN_MODULES } from '../src/modules/registry'
import { filmData, siteModules } from '../src/site-data'

const directory = process.argv[2]
if (directory === undefined) throw new Error('usage: tsx scripts/site-data.ts <output-dir>')

const json = (value: unknown): string => `${JSON.stringify(value)}\n`

await mkdir(directory, { recursive: true })
await writeFile(path.join(directory, 'modules.json'), json(siteModules(BUILTIN_MODULES)))
await writeFile(path.join(directory, 'film.json'), json(await filmData(loadModules())))
