'use client'

import { motion } from 'motion/react'

const BOB_PX = 6
const BOB_SECONDS = 1.6

/** A bobbing pointer to the experience below the film. */
export function ScrollCue() {
  return (
    <a
      href="#experience"
      className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 font-mono text-xs transition-colors"
    >
      see it work
      <motion.span
        aria-hidden
        animate={{ y: [0, BOB_PX, 0] }}
        transition={{ duration: BOB_SECONDS, repeat: Infinity, ease: 'easeInOut' }}
      >
        ⌄
      </motion.span>
    </a>
  )
}
