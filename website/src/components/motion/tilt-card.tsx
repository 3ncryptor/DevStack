'use client'

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'

const MAX_DEGREES = 6
const SPRING = { stiffness: 150, damping: 20 }

/** Tilts gently toward the cursor in 3D. */
export function TiltCard({
  children,
  className
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  const reduced = useReducedMotion()
  const px = useSpring(useMotionValue(0), SPRING)
  const py = useSpring(useMotionValue(0), SPRING)
  const rotateY = useTransform(px, [-0.5, 0.5], [-MAX_DEGREES, MAX_DEGREES])
  const rotateX = useTransform(py, [-0.5, 0.5], [MAX_DEGREES, -MAX_DEGREES])

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced === true) return
    const box = event.currentTarget.getBoundingClientRect()
    px.set((event.clientX - box.left) / box.width - 0.5)
    py.set((event.clientY - box.top) / box.height - 0.5)
  }
  const release = () => {
    px.set(0)
    py.set(0)
  }

  return (
    <div style={{ perspective: 1200 }} className={className}>
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onPointerMove={follow}
        onPointerLeave={release}
      >
        {children}
      </motion.div>
    </div>
  )
}
