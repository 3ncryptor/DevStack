import { useCurrentFrame } from 'remotion'

import { ramp, revealed } from '../anim'
import { Camera } from '../camera'
import type { SceneProps } from '../film-data'
import { Sfx } from '../sfx'
import { TerminalFrame } from '../terminal-frame'

const PUSH_FRAMES = 30
const FIRST_ANSWER_AT = 12
const ANSWER_EVERY = 6
const SHOWN_ANSWERS = 11

/** Scene 3: the camera pushes into the terminal; the wizard's real questions answer themselves. */
export function PickScene({ data }: SceneProps) {
  const frame = useCurrentFrame()
  const answers = data.answers.slice(0, SHOWN_ANSWERS)
  const shown = revealed(frame, FIRST_ANSWER_AT, ANSWER_EVERY, answers.length)

  return (
    <Camera from={{ scale: 1.35, y: 220 }} frames={PUSH_FRAMES}>
      <TerminalFrame title="~/projects">
        <p className="mb-2">
          <span className="text-primary">$ </span>npx {data.packageName} {data.projectName}
        </p>
        {answers.slice(0, shown).map((item, index) => {
          const at = FIRST_ANSWER_AT + index * ANSWER_EVERY
          return (
            <p key={item.question} style={{ opacity: ramp(frame, at, at + 6) }}>
              <span className="text-primary">✔ </span>
              <span className="text-muted-foreground">{item.question} · </span>
              {item.answer}
              <Sfx name="tick" at={at} volume={0.3} />
            </p>
          )
        })}
      </TerminalFrame>
    </Camera>
  )
}
