import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { Sfx } from '../sfx'
import { beats } from '../timing'

const LINES = [
  ['STOP', 'WIRING.'],
  ['START', 'SHIPPING.']
]
const SLAM_SCALE = 0.5

/** Scene 1, the hook: four words slam in, one per beat, each with a hit. */
export function HookScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div className="display absolute inset-0 flex flex-col items-center justify-center gap-6 text-[140px]">
      {LINES.map((words, line) => (
        <p
          key={line}
          className={`flex gap-x-14 ${line === 1 ? 'text-primary' : 'text-foreground'}`}
        >
          {words.map((word, index) => {
            const at = beats(line * words.length + index)
            const slam = spring({ frame: frame - at, fps, config: { damping: 14, mass: 0.5 } })
            return (
              <span
                key={word}
                className="inline-block"
                style={{
                  opacity: Math.min(slam * 2, 1),
                  transform: `scale(${1 + (1 - slam) * SLAM_SCALE})`
                }}
              >
                {word}
                <Sfx name="impact" at={at} volume={0.45} />
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}
