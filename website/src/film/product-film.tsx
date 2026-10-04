import type { ComponentType, ReactNode } from 'react'
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion'

import { Caption } from './caption'
import type { FilmData, SceneProps } from './film-data'
import { CommandScene } from './scenes/command'
import { EndScene } from './scenes/end'
import { EvolveScene } from './scenes/evolve'
import { GenerateScene } from './scenes/generate'
import { GrindScene } from './scenes/grind'
import { PickScene } from './scenes/pick'
import { RunScene } from './scenes/run'
import { VerifyScene } from './scenes/verify'
import { DURATION_IN_FRAMES, SCENES, type SceneId } from './timing'

const SCENE_COMPONENTS: Record<SceneId, ComponentType<SceneProps>> = {
  grind: GrindScene,
  command: CommandScene,
  pick: PickScene,
  generate: GenerateScene,
  verify: VerifyScene,
  run: RunScene,
  evolve: EvolveScene,
  end: EndScene
}

const FADE_FRAMES = 8
const GLOW_TRAVEL_PERCENT = 40

/** Fades a scene in and out at its edges, so scenes cross-dissolve. */
function Fade({ duration, children }: { readonly duration: number; readonly children: ReactNode }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, duration - FADE_FRAMES, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

/** A green glow drifting slowly across the whole film, behind every scene. */
function Backdrop() {
  const frame = useCurrentFrame()
  const x = 30 + (frame / DURATION_IN_FRAMES) * GLOW_TRAVEL_PERCENT
  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage: `radial-gradient(circle at ${x}% 40%, rgb(74 222 128 / 12%), transparent 55%), radial-gradient(var(--border) 1.5px, transparent 1.5px)`,
        backgroundSize: '100% 100%, 36px 36px'
      }}
    />
  )
}

/** The DevStack film (plan: the 40s film): eight scenes from timing.ts, each with its caption. */
export function ProductFilm({ data }: { readonly data: FilmData }) {
  const facts = { files: data.files.length }
  return (
    <AbsoluteFill className="text-foreground">
      <Backdrop />
      {SCENES.map(({ id, from, duration, caption }) => {
        const Scene = SCENE_COMPONENTS[id]
        return (
          <Sequence key={id} from={from} durationInFrames={duration} name={id}>
            <Fade duration={duration}>
              <Scene data={data} duration={duration} />
              <Caption text={caption(facts)} />
            </Fade>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
