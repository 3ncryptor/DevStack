'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { MotionConfig, useReducedMotion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

gsap.registerPlugin(ScrollTrigger)

const MS_PER_SECOND = 1000

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger pins and scrubs stay in step,
 * and the site-wide motion config: users who ask for reduced motion get native scrolling, and
 * motion skips transforms for them (`reducedMotion="user"`).
 */
export function SmoothScroll({ children }: { readonly children: ReactNode }) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced === true) return
    const lenis = new Lenis()
    const tick = (seconds: number): void => lenis.raf(seconds * MS_PER_SECOND)
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [reduced])

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
