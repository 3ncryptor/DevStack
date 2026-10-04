import type { ModuleCategory } from '@repo/src/browser'

import { registry } from '@/lib/registry'

const ROWS: readonly (readonly ModuleCategory[])[] = [
  ['framework', 'database', 'orm', 'auth', 'cache', 'styling', 'testing', 'observability'],
  ['devops', 'quality', 'security', 'middleware', 'api-docs', 'layout', 'repo']
]

const titlesIn = (categories: readonly ModuleCategory[]): string[] =>
  categories.flatMap((category) =>
    [...registry.values()]
      .filter((moduleDefinition) => moduleDefinition.category === category)
      .map((moduleDefinition) => moduleDefinition.title)
  )

/** One endless row; its content is doubled so the loop has no seam. */
function MarqueeRow({ titles, reverse }: { readonly titles: string[]; readonly reverse: boolean }) {
  return (
    <div className="marquee-mask flex overflow-hidden">
      <ul
        className="marquee flex shrink-0 gap-3 pr-3"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        {[...titles, ...titles].map((title, index) => (
          <li
            key={index}
            aria-hidden={index >= titles.length}
            className="border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 rounded-md border px-3 py-1.5 font-mono text-sm whitespace-nowrap transition-colors"
          >
            {title}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Section 3: what DevStack wires, straight from the module registry. */
export function WorksWith() {
  return (
    <section aria-label="Works with" className="border-border border-y py-10">
      <p className="text-muted-foreground mx-auto mb-6 max-w-6xl px-6 font-mono text-sm">
        works with
      </p>
      <div className="flex flex-col gap-3">
        {ROWS.map((categories, index) => (
          <MarqueeRow key={categories[0]} titles={titlesIn(categories)} reverse={index % 2 === 1} />
        ))}
      </div>
    </section>
  )
}
