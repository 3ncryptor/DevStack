import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'

import { ramp } from './anim'

interface Shot {
  readonly scale?: number
  readonly x?: number
  readonly y?: number
  readonly rotateX?: number
  readonly rotateY?: number
}

const NEUTRAL: Required<Shot> = { scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0 }

/** A camera move over the scene: eases from one shot to another across `frames`. */
export function Camera({
  from,
  to = NEUTRAL,
  frames,
  children
}: {
  readonly from: Shot
  readonly to?: Shot
  readonly frames: number
  readonly children: ReactNode
}) {
  const frame = useCurrentFrame()
  const value = (key: keyof Shot): number =>
    ramp(frame, 0, frames, from[key] ?? NEUTRAL[key], to[key] ?? NEUTRAL[key])

  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <AbsoluteFill
        style={{
          transform: `translate(${value('x')}px, ${value('y')}px) scale(${value('scale')}) rotateX(${value('rotateX')}deg) rotateY(${value('rotateY')}deg)`
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
