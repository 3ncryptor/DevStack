'use client'

import { Player, type PlayerRef } from '@remotion/player'
import { useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { FILM_DATA } from '@/film/film-data'
import { ProductFilm } from '@/film/product-film'
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from '@/film/timing'

/**
 * The product film, rendered live by Remotion's player: plays only while on screen; with reduced
 * motion it holds the end card instead of playing.
 */
export function FilmPlayer({ controls = false }: { readonly controls?: boolean }) {
  const player = useRef<PlayerRef>(null)
  const frame = useRef<HTMLDivElement>(null)
  const visible = useInView(frame)
  const reduced = useReducedMotion() === true

  useEffect(() => {
    if (reduced) {
      player.current?.seekTo(DURATION_IN_FRAMES - 1)
      return
    }
    if (visible) player.current?.play()
    else player.current?.pause()
  }, [visible, reduced])

  return (
    <div
      ref={frame}
      {...(controls
        ? {}
        : { role: 'img', 'aria-label': 'DevStack creating, checking and booting a project' })}
    >
      <Player
        ref={player}
        component={ProductFilm}
        inputProps={{ data: FILM_DATA }}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        style={{ width: '100%', aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        loop
        controls={controls}
        clickToPlay={controls}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
