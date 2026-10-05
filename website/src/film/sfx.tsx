import { Audio, Sequence, staticFile } from 'remotion'

/** The effects scripts/make-sfx.ts writes to src/film/audio/ (the render's public folder). */
export type SoundName = 'click' | 'tick' | 'chime' | 'impact' | 'whoosh' | 'glitch'

/** A sound effect played from frame `at` of its scene. */
export function Sfx({
  name,
  at,
  volume = 1
}: {
  readonly name: SoundName
  readonly at: number
  readonly volume?: number
}) {
  return (
    <Sequence from={at} layout="none" name={`sfx:${name}`}>
      <Audio src={staticFile(`${name}.wav`)} volume={volume} />
    </Sequence>
  )
}
