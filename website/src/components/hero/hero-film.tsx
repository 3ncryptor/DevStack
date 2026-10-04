'use client'

import dynamic from 'next/dynamic'

import { TiltCard } from '@/components/motion/tilt-card'
import { AnimatedButton } from '@/components/ui/animated-button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { HEIGHT, WIDTH } from '@/film/timing'

/** Holds the film's place while Remotion loads, so nothing shifts. */
function FilmPoster() {
  return (
    <div
      className="bg-card dot-grid w-full"
      style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      aria-hidden
    />
  )
}

const FilmPlayer = dynamic(() => import('./film-player').then((module) => module.FilmPlayer), {
  ssr: false,
  loading: FilmPoster
})

/** The hero's film in a tilting frame, and the "watch the film" dialog with controls. */
export function HeroFilm() {
  return (
    <div className="flex flex-col gap-4">
      <TiltCard>
        <div className="border-border overflow-hidden rounded-xl border shadow-[0_0_80px_-20px_var(--glow)]">
          <FilmPlayer />
        </div>
      </TiltCard>
      <Dialog>
        <DialogTrigger asChild>
          <AnimatedButton variant="shimmer" className="self-start font-mono">
            ▶ watch the film
          </AnimatedButton>
        </DialogTrigger>
        <DialogContent className="max-w-5xl p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">DevStack product film</DialogTitle>
          <FilmPlayer controls />
        </DialogContent>
      </Dialog>
    </div>
  )
}
