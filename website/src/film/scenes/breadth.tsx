import type { SimpleIcon } from 'simple-icons'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

import { PACKAGE_MANAGERS, type ModuleCategory } from '@repo/src/browser'

import { BrandLogo } from '@/components/brand-logo'
import { MODULE_LOGOS, PACKAGE_MANAGER_LOGOS } from '@/lib/logos'
import { registry } from '@/lib/registry'

import type { SceneProps } from '../film-data'
import { Sfx } from '../sfx'

/** The walls, in order: a title and the module categories whose logos it shows. */
const WALLS: ReadonlyArray<{ title: string; categories: readonly ModuleCategory[] }> = [
  { title: 'frameworks', categories: ['framework'] },
  { title: 'databases', categories: ['database', 'cache'] },
  { title: 'orms', categories: ['orm'] },
  { title: 'auth', categories: ['auth'] },
  { title: 'tested & linted', categories: ['testing', 'quality'] },
  { title: 'shipped', categories: ['devops', 'layout'] }
]

const logosIn = (categories: readonly ModuleCategory[]): SimpleIcon[] =>
  [...registry.values()]
    .filter((moduleDefinition) => categories.includes(moduleDefinition.category))
    .flatMap((moduleDefinition) => MODULE_LOGOS[moduleDefinition.id] ?? [])

const WALL_LOGOS = [
  ...WALLS.map(({ title, categories }) => ({ title, icons: logosIn(categories) })),
  { title: 'package managers', icons: PACKAGE_MANAGERS.map((id) => PACKAGE_MANAGER_LOGOS[id]) }
]

const LOGO_EVERY = 2

/** Scene 9, breadth: walls of real logos, one wall per beat, each landing with a hit. */
export function BreadthScene({ duration }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wallFrames = Math.floor(duration / WALL_LOGOS.length)
  const index = Math.min(WALL_LOGOS.length - 1, Math.floor(frame / wallFrames))
  const wall = WALL_LOGOS[index] ?? WALL_LOGOS[0]
  const local = frame - index * wallFrames

  return (
    <div className="absolute inset-x-0 top-0 flex h-[860px] flex-col items-center justify-center gap-16">
      <p className="text-primary font-mono text-[26px] tracking-[0.4em] uppercase">
        {`// ${wall?.title}`}
      </p>
      <div className="flex gap-24">
        {wall?.icons.map((icon, position) => {
          const pop = spring({
            frame: local - position * LOGO_EVERY,
            fps,
            config: { damping: 12, mass: 0.5 }
          })
          return (
            <div
              key={icon.slug}
              className="flex flex-col items-center gap-6"
              style={{ opacity: Math.min(pop * 2, 1), transform: `scale(${0.5 + pop * 0.5})` }}
            >
              <BrandLogo icon={icon} className="text-foreground size-[150px]" />
              <span className="text-muted-foreground font-mono text-[24px] tracking-[0.2em] uppercase">
                {icon.title}
              </span>
            </div>
          )
        })}
      </div>
      {WALL_LOGOS.map(({ title }, wallIndex) => (
        <Sfx key={title} name="impact" at={wallIndex * wallFrames} volume={0.5} />
      ))}
    </div>
  )
}
