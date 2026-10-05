'use client'

import { useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

const GLYPHS = '!<>-_\\/[]{}=+*^?#'
const FRAME_MS = 30
const FRAMES_PER_CHAR = 1.5

/** Decodes `text` from random glyphs, left to right, when it scrolls into view. */
export function TextScramble({
  text,
  className
}: {
  readonly text: string
  readonly className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(text)

  useEffect(() => {
    if (!inView || reduced === true) return
    let frame = 0
    const total = Math.ceil(text.length * FRAMES_PER_CHAR)
    const timer = setInterval(() => {
      frame += 1
      const settled = Math.floor(frame / FRAMES_PER_CHAR)
      setShown(
        [...text]
          .map((char, index) =>
            index < settled || char === ' '
              ? char
              : (GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? char)
          )
          .join('')
      )
      if (frame >= total) clearInterval(timer)
    }, FRAME_MS)
    return () => clearInterval(timer)
  }, [inView, reduced, text])

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{shown}</span>
    </span>
  )
}
