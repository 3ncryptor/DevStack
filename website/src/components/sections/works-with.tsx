import type { CSSProperties } from 'react'
import type { SimpleIcon } from 'simple-icons'

import { PACKAGE_MANAGERS, type ModuleCategory } from '@repo/src/browser'

import { BrandLogo } from '@/components/brand-logo'
import { MODULE_LOGOS, PACKAGE_MANAGER_LOGOS, visibleColour } from '@/lib/logos'
import { registry } from '@/lib/registry'

const CORE: readonly ModuleCategory[] = ['framework', 'database', 'orm', 'cache', 'auth']

/** The registry's modules that have a logo, in or out of the core categories. */
function logosWhere(inCore: boolean): SimpleIcon[] {
  return [...registry.values()]
    .filter((moduleDefinition) => CORE.includes(moduleDefinition.category) === inCore)
    .flatMap((moduleDefinition) => MODULE_LOGOS[moduleDefinition.id] ?? [])
}

const ROWS: readonly SimpleIcon[][] = [
  logosWhere(true),
  [...logosWhere(false), ...PACKAGE_MANAGERS.map((id) => PACKAGE_MANAGER_LOGOS[id])]
]

function LogoTile({ icon, hidden }: { readonly icon: SimpleIcon; readonly hidden: boolean }) {
  return (
    <li
      aria-hidden={hidden}
      className="group flex w-40 shrink-0 flex-col items-center gap-4 py-6 transition-transform duration-300 hover:-translate-y-1"
      style={{ '--brand': visibleColour(icon) } as CSSProperties}
    >
      <BrandLogo
        icon={icon}
        className="size-16 text-neutral-300 transition-colors duration-300 group-hover:text-(--brand)"
      />
      <span className="label text-muted-foreground group-hover:text-foreground transition-colors">
        {icon.title}
      </span>
    </li>
  )
}

/** One endless row; its content is doubled so the loop has no seam. */
function MarqueeRow({
  icons,
  reverse
}: {
  readonly icons: SimpleIcon[]
  readonly reverse: boolean
}) {
  return (
    <div className="marquee-mask flex overflow-hidden">
      <ul
        className="marquee flex shrink-0 gap-6 pr-6"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        {[...icons, ...icons].map((icon, index) => (
          <LogoTile key={index} icon={icon} hidden={index >= icons.length} />
        ))}
      </ul>
    </div>
  )
}

/** Section 2: what DevStack wires, as logos straight from the module registry. */
export function WorksWith() {
  return (
    <section aria-labelledby="works-with" className="py-28">
      <div className="mx-auto mb-14 max-w-6xl px-6">
        <p className="label text-primary mb-5">{'// works with'}</p>
        <h2 id="works-with" className="display text-5xl sm:text-7xl">
          YOUR STACK.
          <br />
          <span className="text-muted-foreground">ALREADY WIRED.</span>
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {ROWS.map((icons, index) => (
          <MarqueeRow key={index} icons={icons} reverse={index % 2 === 1} />
        ))}
      </div>
    </section>
  )
}
