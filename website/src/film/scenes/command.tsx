import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { ramp } from '../anim'
import type { SceneProps } from '../film-data'
import { Sfx } from '../sfx'
import { beats } from '../timing'

const TYPE_START = beats(0.5)
const TYPE_END = beats(4)
const ENTER_AT = beats(5)

/** Scene 4: the one command types itself, key by key; Enter lands on the beat with a drop. */
export function CommandScene({ data }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const command = `npx ${data.packageName} ${data.projectName}`
  const keyEvery = (TYPE_END - TYPE_START) / command.length
  const typed = command.slice(0, Math.round(ramp(frame, TYPE_START, TYPE_END, 0, command.length)))
  const pressed = spring({ frame: frame - ENTER_AT, fps, config: { damping: 10 } })
  const cursorOn = frame < ENTER_AT && Math.floor(frame / beats(0.5)) % 2 === 0

  return (
    <div className="absolute inset-x-0 top-[330px] flex justify-center">
      <p
        className="bg-card rounded-2xl border px-16 py-10 font-mono text-[68px]"
        style={{
          transform: `scale(${1 + pressed * 0.05})`,
          boxShadow: `0 0 ${pressed * 160}px -10px var(--glow)`,
          borderColor: pressed > 0.05 ? 'var(--primary)' : 'var(--border)'
        }}
      >
        <span className="text-primary">$ </span>
        {typed}
        <span
          className="bg-foreground ml-2 inline-block h-[64px] w-8 align-middle"
          style={{ opacity: cursorOn ? 1 : 0 }}
        />
      </p>
      {[...command].map((_, index) => (
        <Sfx key={index} name="click" at={Math.round(TYPE_START + index * keyEvery)} volume={0.5} />
      ))}
      <Sfx name="impact" at={ENTER_AT} />
    </div>
  )
}
