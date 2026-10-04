'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import dynamic from 'next/dynamic'
import { useRef } from 'react'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { HEIGHT, WIDTH } from '@/film/timing'
import { EASE } from '@/lib/motion'

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

const ENTRANCE_SECONDS = 1.2

/**
 * The hero's film: rises and un-tilts into place on load, eases back as the page scrolls on,
 * and opens full screen with controls.
 */
export function HeroFilm() {
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start start', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.9])
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3])

  return (
    <motion.div ref={stage} style={{ scale, opacity }} className="[perspective:1600px]">
      <motion.div
        initial={{ rotateX: 18, y: 80, opacity: 0 }}
        animate={{ rotateX: 0, y: 0, opacity: 1 }}
        transition={{ duration: ENTRANCE_SECONDS, ease: EASE, delay: 0.2 }}
        className="border-border relative overflow-hidden rounded-2xl border shadow-[0_0_120px_-20px_var(--glow)]"
      >
        <FilmPlayer />
        <Dialog>
          <DialogTrigger className="bg-background/70 text-foreground hover:bg-background absolute right-4 bottom-4 rounded-md border px-3 py-1.5 font-mono text-xs backdrop-blur transition-colors">
            ⤢ full screen
          </DialogTrigger>
          <DialogContent className="max-w-6xl p-0 sm:max-w-6xl">
            <DialogTitle className="sr-only">DevStack film</DialogTitle>
            <FilmPlayer controls />
          </DialogContent>
        </Dialog>
      </motion.div>
    </motion.div>
  )
}
