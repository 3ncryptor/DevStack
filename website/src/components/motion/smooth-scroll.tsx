'use client'

import Lenis from 'lenis'
import { MotionConfig, useReducedMotion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

/**
 * Lenis smooth scrolling and the site-wide motion config: users who ask for reduced motion get
 * native scrolling, and motion skips transforms for them (`reducedMotion="user"`).
 */
export function SmoothScroll({ children }: { readonly children: ReactNode }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced === true) return
    const lenis = new Lenis({ autoRaf: true })
    return () => lenis.destroy()
  }, [reduced])

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
