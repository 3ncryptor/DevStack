import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { Camera } from '../camera'
import type { SceneProps } from '../film-data'
import { Sfx } from '../sfx'

const SERVICES = ['API', 'DB']
const FIRST_SERVICE_AT = 30
const SERVICE_EVERY = 14
const FLY_FRAMES = 40

/** Scene 6: the browser flies in on the generated app's status page, its services connected. */
export function RunScene({ data }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <Camera from={{ rotateX: 28, y: 320, scale: 0.8 }} frames={FLY_FRAMES}>
      <div className="absolute top-[64px] left-1/2 h-[740px] w-[1480px] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-[0_0_160px_-40px_var(--glow)]">
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-100 px-7 py-5">
          <span className="size-4 rounded-full bg-[#ff5f57]" />
          <span className="size-4 rounded-full bg-[#febc2e]" />
          <span className="size-4 rounded-full bg-[#28c840]" />
          <span className="ml-6 rounded-lg bg-white px-6 py-2 font-mono text-2xl text-neutral-500">
            localhost:3000
          </span>
        </div>
        <div className="p-20 text-neutral-900">
          <h1 className="text-[110px] leading-none font-semibold tracking-tight">
            {data.projectName}
          </h1>
          <div className="mt-14 flex gap-16 font-mono text-[52px] text-neutral-600">
            {SERVICES.map((service, index) => {
              const on = spring({ frame: frame - FIRST_SERVICE_AT - index * SERVICE_EVERY, fps })
              return (
                <span
                  key={service}
                  style={{ opacity: on, transform: `translateY(${(1 - on) * 30}px)` }}
                >
                  {service} <span className="text-green-600">✓ connected</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>
      <Sfx name="whoosh" at={0} volume={0.7} />
      <Sfx name="chime" at={FIRST_SERVICE_AT} volume={0.5} />
    </Camera>
  )
}
