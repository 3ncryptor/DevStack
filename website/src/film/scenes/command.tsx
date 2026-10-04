import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { ramp } from '../anim'
import type { SceneProps } from '../film-data'
import { ChipCloud } from './grind'

const COLLAPSE_END = 18
const TYPE_START = 20
const TYPE_END = 55
const ENTER_AT = 64
const BLINK_FRAMES = 15

/** Scene 2: the chores collapse into a cursor, the one command types itself, Enter. */
export function CommandScene({ data }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const command = `npx ${data.packageName} ${data.projectName}`
  const typed = command.slice(0, Math.round(ramp(frame, TYPE_START, TYPE_END, 0, command.length)))
  const pressed = spring({ frame: frame - ENTER_AT, fps, config: { damping: 10 } })
  const cursorOn = frame < ENTER_AT && Math.floor(frame / BLINK_FRAMES) % 2 === 0

  return (
    <>
      <ChipCloud data={data} collapse={ramp(frame, 0, COLLAPSE_END)} settled />
      <div className="absolute inset-x-0 top-[340px] flex justify-center">
        <p
          className="border-border bg-card rounded-2xl border px-14 py-8 font-mono text-[64px]"
          style={{
            opacity: ramp(frame, COLLAPSE_END - 6, TYPE_START),
            transform: `scale(${1 + pressed * 0.04})`,
            boxShadow: `0 0 ${pressed * 140}px -10px var(--glow)`,
            borderColor: pressed > 0.05 ? 'var(--primary)' : undefined
          }}
        >
          <span className="text-primary">$ </span>
          {typed}
          <span
            className="bg-foreground ml-2 inline-block h-[60px] w-7 align-middle"
            style={{ opacity: cursorOn ? 1 : 0 }}
          />
        </p>
      </div>
    </>
  )
}
