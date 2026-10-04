import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

import type { FilmData } from '../film-data'
import { TerminalFrame } from '../terminal-frame'

const INSTALL_FRAMES = 40
const CHECK_EVERY = 12

/** Scene 3: install, then the project's own checks pass one by one, then it boots. */
export function ChecksScene({ data }: { readonly data: FilmData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const installed = interpolate(frame, [0, INSTALL_FRAMES], [0, 100], { extrapolateRight: 'clamp' })
  const checks = [...data.gates, 'boot']

  return (
    <TerminalFrame title={`~/projects/${data.projectName}`}>
      <p className="text-muted-foreground">Installing with pnpm…</p>
      <div className="border-border my-4 h-3 w-full overflow-hidden rounded-full border">
        <div className="bg-primary h-full" style={{ width: `${installed}%` }} />
      </div>
      <p className="text-muted-foreground mb-2">Checking the project</p>
      {checks.map((check, index) => {
        const at = INSTALL_FRAMES + index * CHECK_EVERY
        const pop = spring({ frame: frame - at, fps, config: { damping: 12 } })
        return (
          <p key={check} style={{ opacity: Math.min(pop, 1) }}>
            <span className="text-primary inline-block" style={{ transform: `scale(${pop})` }}>
              ✓
            </span>{' '}
            {check}
          </p>
        )
      })}
    </TerminalFrame>
  )
}
