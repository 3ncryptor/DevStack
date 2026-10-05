import { useCurrentFrame } from 'remotion'

import { ramp } from '../anim'
import { Sfx } from '../sfx'
import { beats } from '../timing'

/** Scene 3, the turn: silence and a lone cursor, then a whoosh into the answer. */
export function TurnScene() {
  const frame = useCurrentFrame()
  const cursorOn = Math.floor(frame / beats(0.5)) % 2 === 0

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10">
      <span className="bg-foreground h-[90px] w-11" style={{ opacity: cursorOn ? 1 : 0 }} />
      <p
        className="text-muted-foreground font-mono text-[22px] tracking-[0.3em] uppercase"
        style={{ opacity: ramp(frame, beats(1), beats(2)) }}
      >
        {"// there's a better way"}
      </p>
      <Sfx name="whoosh" at={beats(3)} volume={0.8} />
    </div>
  )
}
