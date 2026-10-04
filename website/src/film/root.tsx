import '../app/globals.css'

import { loadFont as loadGeist } from '@remotion/google-fonts/Geist'
import { loadFont as loadGeistMono } from '@remotion/google-fonts/GeistMono'
import type { CSSProperties } from 'react'
import { Composition, registerRoot } from 'remotion'

import { FILM_DATA, type FilmData } from './film-data'
import { ProductFilm } from './product-film'
import { DURATION_IN_FRAMES, FILM_COMPOSITION, FPS, HEIGHT, WIDTH } from './timing'

/** The page gets Geist from next/font; a render has no Next, so it loads the same fonts here. */
const FONTS = {
  '--font-geist-sans': loadGeist('normal', { weights: ['400', '600'], subsets: ['latin'] })
    .fontFamily,
  '--font-geist-mono': loadGeistMono('normal', { weights: ['400', '600'], subsets: ['latin'] })
    .fontFamily
} as CSSProperties

function RenderedFilm({ data }: { readonly data: FilmData }) {
  return (
    <div className="dark font-sans" style={{ ...FONTS, width: WIDTH, height: HEIGHT }}>
      <ProductFilm data={data} />
    </div>
  )
}

/** The film as a Remotion composition, for `npm run film:render` (scripts/render-film.ts). */
function Root() {
  return (
    <Composition
      id={FILM_COMPOSITION}
      component={RenderedFilm}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ data: FILM_DATA }}
    />
  )
}

registerRoot(Root)
