import { BarList } from '@/components/charts/bar-list'
import { CountUp } from '@/components/motion/count-up'
import { Reveal } from '@/components/motion/reveal'
import { CHECKS, FILM_DATA } from '@/film/film-data'
import { STATS } from '@/lib/stats'

const TOP_CATEGORIES = 8

/** The roadmap so far (buildPlan.md, Phases 0–7); the last one is being built now. */
const MILESTONES = [
  { phase: 'Phase 0', title: 'Foundation', detail: 'Stabilised CLI, strict TypeScript, tests' },
  {
    phase: 'Phase 1',
    title: 'Resolution engine',
    detail: 'Module contract v2, dependency resolver'
  },
  {
    phase: 'Phase 2',
    title: 'Layouts & package managers',
    detail: 'Monorepo, npm · pnpm · yarn · bun'
  },
  { phase: 'Phase 3', title: 'Node breadth', detail: 'Fastify, NestJS, Drizzle, Mongoose, Vite' },
  { phase: 'Phase 4', title: 'Auth & observability', detail: 'JWT, Better Auth, logs, API docs' },
  { phase: 'Phase 5', title: 'Evolve & AI', detail: 'add, remove, doctor, MCP server' },
  { phase: 'Phase 6', title: '1.0 hardening', detail: 'Frozen contract, release gate' },
  { phase: 'Phase 7', title: 'This website', detail: 'The builder, the film, the docs' }
]

const sizes = STATS.presets.map((preset) => preset.files)

const CARDS = [
  {
    label: 'modules',
    value: STATS.modules,
    detail: `across ${STATS.categories.length} categories`
  },
  { label: 'package managers', value: STATS.packageManagers, detail: 'npm · pnpm · yarn · bun' },
  { label: 'checks per project', value: CHECKS.length, detail: CHECKS.join(' · ') },
  {
    label: 'files, one command',
    value: Math.max(...sizes),
    detail: `${Math.min(...sizes)}–${Math.max(...sizes)} per preset`
  }
]

function StatCard({ label, value, detail }: (typeof CARDS)[number]) {
  return (
    <div className="border-border bg-card flex flex-col gap-6 rounded-2xl border p-6">
      <p className="label text-muted-foreground">{label}</p>
      <CountUp value={value} className="display text-6xl" />
      <p className="text-muted-foreground truncate font-mono text-xs">{detail}</p>
    </div>
  )
}

/** Section: the numbers, after neutronfest.org's analytics; everything counted from DevStack. */
export function Stats() {
  return (
    <section aria-labelledby="stats" className="mx-auto max-w-6xl px-6 py-28">
      <p className="label text-primary mb-5 flex items-center gap-3">
        {'// by the numbers'}
        <span className="bg-primary size-1.5 animate-pulse rounded-full" aria-hidden />
        <span className="text-muted-foreground">counted from the repo</span>
      </p>
      <Reveal>
        <h2 id="stats" className="display mb-14 text-5xl sm:text-7xl">
          THE NUMBERS.
        </h2>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border-border bg-card flex flex-col gap-10 rounded-2xl border p-6 sm:p-8">
          <div>
            <h3 className="mb-1 text-lg font-semibold">Files each preset plans</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              One command each; the film builds {FILM_DATA.projectName} from the highlighted one.
            </p>
            <BarList
              rows={STATS.presets.map((preset) => ({ label: preset.name, value: preset.files }))}
              unit="files"
              highlight="fullstack-next-express"
            />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-semibold">Modules by category</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              The largest of {STATS.categories.length} categories.
            </p>
            <BarList
              rows={STATS.categories
                .slice(0, TOP_CATEGORIES)
                .map((row) => ({ label: row.category, value: row.modules }))}
              unit="modules"
            />
          </div>
        </div>

        <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
          <p className="label text-muted-foreground mb-8">milestones</p>
          <ol className="border-border relative flex flex-col gap-6 border-l pl-6">
            {MILESTONES.map((milestone, index) => {
              const current = index === MILESTONES.length - 1
              return (
                <li key={milestone.phase} className="relative">
                  <span
                    aria-hidden
                    className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full ${current ? 'bg-primary animate-pulse' : 'bg-foreground/60'}`}
                  />
                  <p className="text-muted-foreground font-mono text-[11px]">
                    {milestone.phase}
                    {current && <span className="text-primary"> · now</span>}
                  </p>
                  <p className="font-medium">{milestone.title}</p>
                  <p className="text-muted-foreground text-xs">{milestone.detail}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
