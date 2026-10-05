import type { ComponentType, ReactNode } from 'react'
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion'

import { Caption } from './caption'
import type { FilmData, SceneProps } from './film-data'
import { BreadthScene } from './scenes/breadth'
import { CommandScene } from './scenes/command'
import { EndScene } from './scenes/end'
import { EvolveScene } from './scenes/evolve'
import { GenerateScene } from './scenes/generate'
import { HookScene } from './scenes/hook'
import { PainScene } from './scenes/pain'
import { PickScene } from './scenes/pick'
import { RunScene } from './scenes/run'
import { TurnScene } from './scenes/turn'
import { VerifyScene } from './scenes/verify'
import { beats, DURATION_IN_FRAMES, SCENES, type SceneId } from './timing'

const SCENE_COMPONENTS: Record<SceneId, ComponentType<SceneProps>> = {
  hook: HookScene,
  pain: PainScene,
  turn: TurnScene,
  command: CommandScene,
  pick: PickScene,
  generate: GenerateScene,
  verify: VerifyScene,
  run: RunScene,
  breadth: BreadthScene,
  evolve: EvolveScene,
  end: EndScene
}

const FADE_FRAMES = 4
const GLOW_TRAVEL_PERCENT = 40
const MUSIC_VOLUME = 0.8
/** Near-instant: the first hit of the hook must land at full strength. */
const MUSIC_FADE_IN_FRAMES = 3

/** Fades a scene in and out at its edges: short, so cuts still land on the beat. */
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
        backgroundImage: `radial-gradient(circle at ${x}% 40%, rgb(74 222 128 / 10%), transparent 55%), radial-gradient(var(--border) 1.5px, transparent 1.5px)`,
        backgroundSize: '100% 100%, 36px 36px'
      }}
    />
  )
}

/** The track under the whole film: in at once, out over the end card's last bar. */
const musicVolume = (frame: number): number =>
  interpolate(
    frame,
    [0, MUSIC_FADE_IN_FRAMES, DURATION_IN_FRAMES - beats(4), DURATION_IN_FRAMES],
    [0, MUSIC_VOLUME, MUSIC_VOLUME, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

/**
 * The DevStack film (plan: the film): scenes from timing.ts cut to the music, each with its
 * line, over the music composed for it (scripts/make-music.ts → src/film/audio/music.wav).
 */
export function ProductFilm({
  data,
  hasMusic = false
}: {
  readonly data: FilmData
  readonly hasMusic?: boolean
}) {
  const facts = { files: data.files.length, modules: data.modules }
  return (
    <AbsoluteFill className="text-foreground">
      <Backdrop />
      {hasMusic && <Audio src={staticFile('music.wav')} volume={musicVolume} />}
      {SCENES.map(({ id, from, duration, caption }) => {
        const Scene = SCENE_COMPONENTS[id]
        return (
          <Sequence key={id} from={from} durationInFrames={duration} name={id}>
            <Fade duration={duration}>
              <Scene data={data} duration={duration} />
              {caption !== undefined && <Caption text={caption(facts)} />}
            </Fade>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
