import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { ramp } from '../anim'
import { checksOf, type SceneProps } from '../film-data'
import { Sfx } from '../sfx'
import { TerminalFrame } from '../terminal-frame'

const INSTALL_FRAMES = 30
const CHECK_EVERY = 14
const SLAM_SCALE = 0.6

/** Scene 5: install, then each of the project's own checks slams in, ending with a real boot. */
export function VerifyScene({ data }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const installed = ramp(frame, 0, INSTALL_FRAMES)

  return (
    <TerminalFrame title={`~/projects/${data.projectName}`}>
      <p className="text-muted-foreground">installing with pnpm…</p>
      <div className="bg-muted my-5 h-4 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full origin-left"
          style={{ transform: `scaleX(${installed})` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-16 gap-y-4 pt-4 text-[44px]">
        {checksOf(data).map((check, index) => {
          const slam = spring({
            frame: frame - INSTALL_FRAMES - index * CHECK_EVERY,
            fps,
            config: { damping: 11, mass: 0.6 }
          })
          return (
            <p
              key={check}
              className="border-border bg-background/60 rounded-xl border px-8 py-4"
              style={{
                opacity: Math.min(slam, 1),
                transform: `scale(${1 + (1 - slam) * SLAM_SCALE})`
              }}
            >
              <span className="text-primary">✓ </span>
              {check}
              <Sfx
                name={index === checksOf(data).length - 1 ? 'chime' : 'tick'}
                at={INSTALL_FRAMES + index * CHECK_EVERY}
                volume={0.5}
              />
            </p>
          )
        })}
      </div>
    </TerminalFrame>
  )
}
