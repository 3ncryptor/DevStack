import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import type { FilmData } from '../film-data'

const SERVICES = ['API', 'DB']
const SERVICE_EVERY = 14

/** Scene 4: the app is up; its status page shows the API and the database connected. */
export function BrowserScene({ data }: { readonly data: FilmData }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const slide = spring({ frame, fps, config: { damping: 16 } })

  return (
    <div
      className="border-border absolute inset-x-16 inset-y-14 overflow-hidden rounded-xl border bg-white shadow-2xl"
      style={{ transform: `translateY(${(1 - slide) * 120}px)`, opacity: slide }}
    >
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-100 px-5 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 rounded-md bg-white px-4 py-1 font-mono text-sm text-neutral-500">
          localhost:3000
        </span>
      </div>
      <div className="p-10 text-neutral-900">
        <h1 className="text-5xl font-semibold">{data.projectName}</h1>
        <p className="mt-6 flex gap-8 font-mono text-2xl text-neutral-600">
          {SERVICES.map((service, index) => {
            const on = spring({ frame: frame - 25 - index * SERVICE_EVERY, fps })
            return (
              <span key={service} style={{ opacity: on }}>
                {service} <span className="text-green-600">✓ connected</span>
              </span>
            )
          })}
        </p>
      </div>
    </div>
  )
}
