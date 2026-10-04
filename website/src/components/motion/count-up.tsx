'use client'

import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { EASE } from '@/lib/motion'

const DURATION_S = 1.2

/** Counts from 0 to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  className
}: {
  readonly value: number
  readonly className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)

  useEffect(() => {
    if (!inView || reduced === true) return
    const controls = animate(0, value, {
      duration: DURATION_S,
      ease: EASE,
      onUpdate: (latest) => setShown(Math.round(latest))
    })
    return () => controls.stop()
  }, [inView, reduced, value])

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  )
}
