import { interpolate, useCurrentFrame } from 'remotion'

import type { FilmData } from '../film-data'

/** Scene 5: the wordmark, the one command, the promise. */
export function EndCard({ data }: { readonly data: FilmData }) {
  const frame = useCurrentFrame()
  const rise = (start: number) => ({
    opacity: interpolate(frame, [start, start + 15], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }),
    transform: `translateY(${interpolate(frame, [start, start + 15], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`
  })

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 font-mono">
      <p className="text-6xl font-semibold" style={rise(0)}>
        <span className="text-primary">&gt;_</span> devstack
      </p>
      <p className="border-border bg-card rounded-lg border px-8 py-4 text-3xl" style={rise(12)}>
        <span className="text-primary">$ </span>npx {data.packageName} {data.projectName}
      </p>
      <p className="text-muted-foreground text-2xl" style={rise(24)}>
        wired and verified.
      </p>
    </div>
  )
}
