import { interpolate, useCurrentFrame } from 'remotion'

import type { FilmData } from '../film-data'
import { TerminalFrame } from '../terminal-frame'

const TYPE_FRAMES = 40
const ANSWER_EVERY = 9
const SHOWN_ANSWERS = 8

/** Scene 1: the command types itself, then the wizard's real questions answer themselves. */
export function WizardScene({ data }: { readonly data: FilmData }) {
  const frame = useCurrentFrame()
  const command = `npx ${data.packageName} ${data.projectName}`
  const typed = command.slice(
    0,
    Math.floor(
      interpolate(frame, [0, TYPE_FRAMES], [0, command.length], { extrapolateRight: 'clamp' })
    )
  )

  return (
    <TerminalFrame title="~/projects">
      <p>
        <span className="text-primary">$ </span>
        {typed}
        {frame < TYPE_FRAMES && (
          <span className="bg-foreground ml-0.5 inline-block h-6 w-3 align-middle" />
        )}
      </p>
      {data.answers.slice(0, SHOWN_ANSWERS).map((item, index) => {
        const appear = TYPE_FRAMES + 6 + index * ANSWER_EVERY
        const opacity = interpolate(frame, [appear, appear + 5], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        })
        return (
          <p key={item.question} style={{ opacity }}>
            <span className="text-primary">✔ </span>
            <span className="text-muted-foreground">{item.question} · </span>
            {item.answer}
          </p>
        )
      })}
    </TerminalFrame>
  )
}
