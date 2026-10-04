/**
 * Renders the DevStack film outside the page (plan: the 40s film), for the README and socials.
 * Run from website/ through npm:
 *   npm run film:render             → out/devstack.mp4
 *   npm run film:still -- 0 600     → out/frame-0.png, out/frame-600.png
 */
import path from 'node:path'

import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { enableTailwind } from '@remotion/tailwind-v4'

import { FILM_COMPOSITION } from '../src/film/timing'

const WEBSITE = process.cwd()
const OUT = path.join(WEBSITE, 'out')

/** The film's bundle: root.tsx with Tailwind and the site's `@` and `@repo` import aliases. */
function filmBundle(): Promise<string> {
  return bundle({
    entryPoint: path.join(WEBSITE, 'src/film/root.tsx'),
    webpackOverride: (config) =>
      enableTailwind({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias as Record<string, string> | undefined),
            '@': path.join(WEBSITE, 'src'),
            '@repo': path.join(WEBSITE, '..')
          }
        }
      })
  })
}

async function main(): Promise<void> {
  const [mode = 'video', ...frames] = process.argv.slice(2)
  if (mode !== 'video' && mode !== 'still') throw new Error(`unknown mode "${mode}": video | still`)

  const serveUrl = await filmBundle()
  const composition = await selectComposition({ serveUrl, id: FILM_COMPOSITION })
  if (mode === 'video') {
    const outputLocation = path.join(OUT, 'devstack.mp4')
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation })
    return
  }
  for (const frame of frames.map(Number)) {
    await renderStill({
      composition,
      serveUrl,
      frame,
      output: path.join(OUT, `frame-${frame}.png`)
    })
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
