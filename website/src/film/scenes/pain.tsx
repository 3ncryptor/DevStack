import { random, spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { ramp } from '../anim'
import type { FilmData, SceneProps } from '../film-data'
import { Sfx } from '../sfx'
import { Slices } from '../slices'
import { beats } from '../timing'

const CONFIG_FILE = /^\.|config\.|\.ya?ml$|^Dockerfile$|\.prisma$|^tsconfig/
/** Names everyone recognises go first; any of them the stack does not plan is skipped. */
const FAMOUS = [
  'tsconfig.json',
  'docker-compose.yml',
  'Dockerfile',
  'schema.prisma',
  '.env',
  'eslint.config.mjs',
  'ci.yml',
  'vitest.config.ts',
  'next.config.ts',
  '.prettierrc',
  'turbo.json',
  'commitlint.config.cjs'
]
const SHOWN = 12
const COLUMNS = 4
const STAGE = { left: 160, top: 60, width: 1600, height: 640 }
const MAX_SHAKE_PX = 10

/** The config files this very stack needs, by name: what you would otherwise wire by hand. */
function configFiles(data: FilmData): string[] {
  const names = new Set(data.files.map((file) => file.split('/').at(-1) ?? file))
  const rank = (name: string): number => {
    const at = FAMOUS.indexOf(name)
    return at === -1 ? FAMOUS.length : at
  }
  return [...names]
    .filter((name) => CONFIG_FILE.test(name))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, SHOWN)
}

/** Scene 2, the pain: config files pile up and shake, glitching, then columns cut to black. */
export function PainScene({ data, duration }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const files = configFiles(data)
  const every = Math.floor(beats(6) / files.length)
  const rows = Math.ceil(files.length / COLUMNS)
  const shake = ramp(frame, 0, beats(7), 0, MAX_SHAKE_PX)

  return (
    <>
      {files.map((name, index) => {
        const enter = spring({ frame: frame - index * every, fps, config: { damping: 11 } })
        const x = STAGE.left + ((index % COLUMNS) + 0.5) * (STAGE.width / COLUMNS)
        const y = STAGE.top + (Math.floor(index / COLUMNS) + 0.5) * (STAGE.height / rows)
        const tilt = (random(`t${index}`) - 0.5) * 14
        const jitter = Math.sin(frame * 1.7 + index * 3) * shake
        return (
          <p
            key={name}
            className="border-border bg-card absolute rounded-xl border px-7 py-4 font-mono text-[34px] whitespace-nowrap"
            style={{
              left: x + jitter,
              top: y,
              opacity: enter,
              transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${0.6 + enter * 0.4})`
            }}
          >
            <span className="text-destructive">✗ </span>
            {name}
          </p>
        )
      })}
      {[0, 2, 4, 6].map((beat) => (
        <Sfx key={beat} name="glitch" at={beats(beat)} volume={0.5} />
      ))}
      <Slices progress={ramp(frame, duration - beats(1), duration)} />
    </>
  )
}
