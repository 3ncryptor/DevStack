import { useCurrentFrame } from 'remotion'

import { REPOSITORY } from '@/lib/site'

import { ramp } from '../anim'
import type { SceneProps } from '../film-data'
import { Sfx } from '../sfx'

const RISE_FRAMES = 15
const RISE_PX = 30

/** Scene 8: the wordmark, the one command, where to find it. */
export function EndScene({ data }: SceneProps) {
  const frame = useCurrentFrame()
  const rise = (start: number) => ({
    opacity: ramp(frame, start, start + RISE_FRAMES),
    transform: `translateY(${ramp(frame, start, start + RISE_FRAMES, RISE_PX, 0)}px)`
  })

  return (
    <div className="absolute inset-x-0 top-0 flex h-[860px] flex-col items-center justify-center gap-14 font-mono">
      <p className="text-[140px] leading-none font-semibold tracking-tight" style={rise(0)}>
        <span className="text-primary">&gt;_</span> devstack
      </p>
      <p
        className="border-primary bg-card rounded-2xl border px-14 py-7 text-[56px] shadow-[0_0_120px_-20px_var(--glow)]"
        style={rise(12)}
      >
        <span className="text-primary">$ </span>npx {data.packageName} {data.projectName}
      </p>
      <p className="text-muted-foreground text-[34px]" style={rise(24)}>
        free &amp; open source · {REPOSITORY.replace('https://', '')}
      </p>
      <Sfx name="impact" at={0} volume={0.5} />
    </div>
  )
}
