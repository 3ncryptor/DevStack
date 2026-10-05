import { Reveal, Stagger, StaggerItem } from '@/components/motion/reveal'
import { SpotlightCard } from '@/components/spotlight-card'
import { CHECKS, FILM_DATA } from '@/film/film-data'
import { STATS } from '@/lib/stats'

import cliPackage from '@repo/package.json'

const SAFETY = [
  'Nothing is written until the whole plan has rendered.',
  '--yes never overwrites; anything replaced is backed up first.',
  'remove deletes only files it made that you have not changed.'
]

function TileTitle({ label, title }: { readonly label: string; readonly title: string }) {
  return (
    <>
      <p className="label text-muted-foreground mb-3">{label}</p>
      <h3 className="mb-4 text-xl font-semibold">{title}</h3>
    </>
  )
}

/** Section: what you get, as a bento of real output (the generated code, the real diff). */
export function Bento() {
  const { evolve } = FILM_DATA
  return (
    <section aria-labelledby="features" className="mx-auto max-w-6xl px-6 py-28">
      <p className="label text-primary mb-5">{'// what you get'}</p>
      <Reveal>
        <h2 id="features" className="display mb-14 text-5xl sm:text-7xl">
          WIRED. CHECKED.
          <br />
          <span className="text-muted-foreground">YOURS.</span>
        </h2>
      </Reveal>

      <Stagger className="grid gap-4 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2 lg:row-span-2">
          <SpotlightCard className="h-full">
            <TileTitle
              label="wired, not just installed"
              title="Every module lands in the right place."
            />
            <p className="text-muted-foreground mb-6 text-sm">
              Helmet, CORS, rate limiting and logging, in the order they belong. This is the
              generated <code className="font-mono">{STATS.showcase.path}</code>, unedited:
            </p>
            <pre className="border-border bg-background overflow-x-auto rounded-xl border p-5 font-mono text-[13px] leading-relaxed">
              <code>{STATS.showcase.code}</code>
            </pre>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <TileTitle label="esm or commonjs" title="Your module system." />
            <p className="text-muted-foreground mb-4 text-sm">
              ES modules by default; CommonJS for the API with one flag. Web apps stay ESM.
            </p>
            <code className="text-primary font-mono text-sm">--module-system cjs</code>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <TileTitle label="grows with you" title="Add or remove modules later." />
            <p className="mb-4 font-mono text-sm">
              <span className="text-primary">$ </span>npx {cliPackage.name} add {evolve.module}
            </p>
            <p className="font-mono text-2xl">
              <span className="text-primary">+{evolve.added.length}</span>
              <span className="text-muted-foreground"> new · </span>
              <span className="text-warning">~{evolve.changed.length}</span>
              <span className="text-muted-foreground"> rewired</span>
            </p>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <TileTitle label="verified" title="Checked before you see it." />
            <ul className="flex flex-wrap gap-2">
              {CHECKS.map((check) => (
                <li
                  key={check}
                  className="border-border rounded-md border px-2.5 py-1 font-mono text-xs"
                >
                  <span className="text-primary">✓</span> {check}
                </li>
              ))}
            </ul>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <TileTitle label="safe by default" title="It never clobbers your work." />
            <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
              {SAFETY.map((line) => (
                <li key={line}>— {line}</li>
              ))}
            </ul>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full">
            <TileTitle label="doctor" title="Knows when things drift." />
            <p className="text-muted-foreground mb-4 text-sm">
              Checks Node.js, package managers, git and Docker; inside a project, the dependencies
              that differ from DevStack&apos;s catalog.
            </p>
            <code className="text-primary font-mono text-sm">npx {cliPackage.name} doctor</code>
          </SpotlightCard>
        </StaggerItem>
      </Stagger>
    </section>
  )
}
