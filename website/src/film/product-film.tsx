import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion'

import type { FilmData } from './film-data'
import { BrowserScene } from './scenes/browser'
import { ChecksScene } from './scenes/checks'
import { EndCard } from './scenes/end-card'
import { FilesScene } from './scenes/files'
import { WizardScene } from './scenes/wizard'
import { SCENES } from './timing'

const FADE_FRAMES = 8

/** Fades a scene in and out at its edges, so scenes cross-dissolve. */
function Fade({
  duration,
  children
}: {
  readonly duration: number
  readonly children: React.ReactNode
}) {
  const frame = useCurrentFrame()
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, duration - FADE_FRAMES, duration],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }
  )
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

/** The hero's product film (plan: hero storyboard): wizard → files → checks → app → end card. */
export function ProductFilm({ data }: { readonly data: FilmData }) {
  const scenes = [
    { key: 'wizard', timing: SCENES.wizard, node: <WizardScene data={data} /> },
    { key: 'files', timing: SCENES.files, node: <FilesScene data={data} /> },
    { key: 'checks', timing: SCENES.checks, node: <ChecksScene data={data} /> },
    { key: 'browser', timing: SCENES.browser, node: <BrowserScene data={data} /> },
    { key: 'end', timing: SCENES.end, node: <EndCard data={data} /> }
  ]
  return (
    <AbsoluteFill className="bg-background dot-grid">
      {scenes.map(({ key, timing, node }) => (
        <Sequence key={key} from={timing.from} durationInFrames={timing.duration}>
          <Fade duration={timing.duration}>{node}</Fade>
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
