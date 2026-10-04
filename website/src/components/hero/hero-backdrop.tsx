'use client'

import { useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'

const Dither = dynamic(() => import('@/components/ui/dither').then((module) => module.Dither), {
  ssr: false
})

/** A slow, dimmed WebGL grain behind the hero; none for reduced motion. */
export function HeroBackdrop() {
  const reduced = useReducedMotion() === true
  if (reduced) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
      <Dither
        color1="#0a0b0d"
        color2="#0f2e1c"
        color3="#4ade80"
        timeSpeed={0.15}
        grainAmount={0.08}
        className="h-full w-full"
      />
    </div>
  )
}
