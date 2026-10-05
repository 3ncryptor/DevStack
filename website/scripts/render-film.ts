/**
 * Renders the DevStack film outside the page (plan: the film), one file for X, LinkedIn,
 * YouTube and the site's hero. Run from website/ through npm:
 *   npm run film:render             → out/devstack.mp4, copied to public/film/ with a poster
 *   npm run film:still -- 0 600     → out/frame-0.png, out/frame-600.png
 * Music plays when the licensed track is at src/film/audio/music.mp3; the sound effects come
 * from `npm run film:sfx`.
 */
import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { enableTailwind } from '@remotion/tailwind-v4'

import { FILM_COMPOSITION, beats } from '../src/film/timing'

const WEBSITE = process.cwd()
const OUT = path.join(WEBSITE, 'out')
const AUDIO = path.join(WEBSITE, 'src/film/audio')
const PUBLIC_FILM = path.join(WEBSITE, 'public/film')
/** The poster: the hook's last beat, both lines on screen. */
const POSTER_FRAME = beats(3.5)

/** The film's bundle: root.tsx with Tailwind, the site's import aliases and the audio folder. */
function filmBundle(): Promise<string> {
  return bundle({
    entryPoint: path.join(WEBSITE, 'src/film/root.tsx'),
    publicDir: AUDIO,
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

  const inputProps = { hasMusic: existsSync(path.join(AUDIO, 'music.mp3')) }
  const serveUrl = await filmBundle()
  const composition = await selectComposition({ serveUrl, id: FILM_COMPOSITION, inputProps })

  if (mode === 'still') {
    for (const frame of frames.map(Number)) {
      const output = path.join(OUT, `frame-${frame}.png`)
      await renderStill({ composition, serveUrl, frame, output, inputProps })
    }
    return
  }

  if (!inputProps.hasMusic) console.warn('no src/film/audio/music.mp3: rendering without music')
  const master = path.join(OUT, 'devstack.mp4')
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    outputLocation: master
  })
  await mkdir(PUBLIC_FILM, { recursive: true })
  await copyFile(master, path.join(PUBLIC_FILM, 'devstack.mp4'))
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame: POSTER_FRAME,
    imageFormat: 'jpeg',
    jpegQuality: 85,
    output: path.join(PUBLIC_FILM, 'poster.jpeg')
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
