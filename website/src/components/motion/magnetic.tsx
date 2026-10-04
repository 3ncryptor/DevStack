'use client'

import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'

const PULL = 0.25
const SPRING = { stiffness: 250, damping: 18, mass: 0.4 }

/** Pulls its child a little toward the cursor, then springs back. */
export function Magnetic({ children }: { readonly children: ReactNode }) {
  const reduced = useReducedMotion()
  const x = useSpring(useMotionValue(0), SPRING)
  const y = useSpring(useMotionValue(0), SPRING)

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced === true) return
    const box = event.currentTarget.getBoundingClientRect()
    x.set((event.clientX - box.left - box.width / 2) * PULL)
    y.set((event.clientY - box.top - box.height / 2) * PULL)
  }
  const release = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      className="inline-block"
      style={{ x, y }}
      onPointerMove={follow}
      onPointerLeave={release}
    >
      {children}
    </motion.div>
  )
}
