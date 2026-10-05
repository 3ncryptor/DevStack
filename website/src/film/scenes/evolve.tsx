import { useCurrentFrame } from 'remotion'

import { ramp } from '../anim'
import { Camera } from '../camera'
import type { SceneProps } from '../film-data'
import { Sfx } from '../sfx'
import { TerminalFrame } from '../terminal-frame'

const TYPE_END = 25
const LIST_START = 34
const LINE_PX = 50
const VISIBLE_LINES = 9

/** Scene 7: `add auth-jwt` on the generated project, and what it really changes. */
export function EvolveScene({ data, duration }: SceneProps) {
  const frame = useCurrentFrame()
  const { module, added, changed } = data.evolve
  const command = `npx ${data.packageName} add ${module}`
  const typed = command.slice(0, Math.round(ramp(frame, 0, TYPE_END, 0, command.length)))
  const lines = [
    ...added.map((path) => ({ path, mark: '+' })),
    ...changed.map((path) => ({ path, mark: '~' }))
  ]
  const scroll = ramp(frame, LIST_START, duration - 15, 0, (lines.length - VISIBLE_LINES) * LINE_PX)

  return (
    <Camera from={{ scale: 1.08 }} frames={duration}>
      <TerminalFrame title={`~/projects/${data.projectName}`}>
        <p>
          <span className="text-primary">$ </span>
          {typed}
        </p>
        <p className="mt-2 mb-4" style={{ opacity: ramp(frame, TYPE_END, LIST_START) }}>
          <span className="text-primary">+{added.length} new</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-warning">~{changed.length} rewired</span>
        </p>
        <div
          className="overflow-hidden"
          style={{
            height: VISIBLE_LINES * LINE_PX,
            opacity: ramp(frame, LIST_START, LIST_START + 8)
          }}
        >
          <div style={{ transform: `translateY(${-scroll}px)` }}>
            {lines.map(({ path, mark }) => (
              <p key={path} style={{ height: LINE_PX }}>
                <span className={mark === '+' ? 'text-primary' : 'text-warning'}>{mark} </span>
                {path}
              </p>
            ))}
          </div>
        </div>
        {[...command].map((_, index) => (
          <Sfx
            key={index}
            name="click"
            at={Math.round((index * TYPE_END) / command.length)}
            volume={0.4}
          />
        ))}
        <Sfx name="chime" at={TYPE_END} volume={0.4} />
      </TerminalFrame>
    </Camera>
  )
}
