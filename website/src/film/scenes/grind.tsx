import { random, spring, useCurrentFrame, useVideoConfig } from 'remotion'

import type { FilmData, SceneProps } from '../film-data'

const SKIPPED = new Set(['No', 'None', 'None (clean setup)'])
const CHIP_EVERY = 3
const JITTER_PX = 4
const STAGE = { left: 140, top: 90, width: 1640, height: 680 }
const COLUMNS = 4

/** Everything the film's stack wires, as chips: "Docker · Yes" → Docker, "Tests · Vitest" → Vitest. */
function stackParts(data: FilmData): string[] {
  const parts = data.answers.flatMap(({ question, answer }) =>
    answer === 'Yes' ? [question] : SKIPPED.has(answer) ? [] : answer.split(', ')
  )
  return [...new Set(parts)]
}

/** The chips, scattered and jittering; `collapse` 0 → 1 pulls them into the centre. */
export function ChipCloud({
  data,
  collapse,
  settled = false
}: {
  readonly data: FilmData
  readonly collapse: number
  /** Already on screen (no entrance), as when the next scene picks them up. */
  readonly settled?: boolean
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const centre = { x: STAGE.left + STAGE.width / 2, y: STAGE.top + STAGE.height / 2 }
  const parts = stackParts(data)
  const rows = Math.ceil(parts.length / COLUMNS)
  const cell = { width: STAGE.width / COLUMNS, height: STAGE.height / rows }
  // One chip per grid cell, cells taken in a shuffled order, so chips scatter without piling up.
  const cells = parts.map((_, index) => index).sort((a, b) => random(`c${a}`) - random(`c${b}`))

  return (
    <>
      {parts.map((part, index) => {
        const at = cells[index] ?? index
        const x =
          STAGE.left + ((at % COLUMNS) + 0.5 + (random(`x${index}`) - 0.5) * 0.3) * cell.width
        const y =
          STAGE.top +
          (Math.floor(at / COLUMNS) + 0.5 + (random(`y${index}`) - 0.5) * 0.3) * cell.height
        const tilt = (random(`r${index}`) - 0.5) * 16
        const enter = settled
          ? 1
          : spring({ frame: frame - index * CHIP_EVERY, fps, config: { damping: 12 } })
        const jitter = Math.sin(frame * 0.35 + index) * JITTER_PX
        const atX = x + (centre.x - x) * collapse + jitter
        const atY = y + (centre.y - y) * collapse
        return (
          <span
            key={part}
            className="border-border bg-card text-muted-foreground absolute rounded-xl border px-6 py-3 font-mono text-[30px] whitespace-nowrap"
            style={{
              left: atX,
              top: atY,
              opacity: enter * (1 - collapse),
              transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${enter * (1 - collapse * 0.8)})`
            }}
          >
            {part}
          </span>
        )
      })}
    </>
  )
}

/** Scene 1: the chores of a new project pile up. */
export function GrindScene({ data }: SceneProps) {
  return <ChipCloud data={data} collapse={0} />
}
