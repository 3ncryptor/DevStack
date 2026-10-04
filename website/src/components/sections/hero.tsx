import { PACKAGE_MANAGERS } from '@repo/src/browser'

import { CopyCommand } from '@/components/copy-command'
import { CtaLink } from '@/components/cta-link'
import { HeroBackdrop } from '@/components/hero/hero-backdrop'
import { HeroFilm } from '@/components/hero/hero-film'
import { CountUp } from '@/components/motion/count-up'
import { Reveal } from '@/components/motion/reveal'
import { TextScramble } from '@/components/motion/text-scramble'
import { choiceLabels, registry } from '@/lib/registry'

import cliPackage from '@repo/package.json'

/** Section 2: the promise, the one command, and the product film. */
export function Hero() {
  return (
    <section className="dot-grid relative overflow-hidden">
      <HeroBackdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1.1fr] lg:py-28">
        <div className="flex flex-col gap-7">
          <TextScramble
            text="// production-ready stacks"
            className="text-primary font-mono text-sm"
          />
          <Reveal>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Production-ready stacks, <span className="text-primary">wired and verified</span>.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-muted-foreground max-w-xl text-lg">
              Pick a stack, run one command, and get a project that installs, passes its own checks
              and boots before it is handed to you.
            </p>
          </Reveal>
          <Reveal delay={0.2} className="flex flex-col gap-4">
            <CopyCommand command={`npx ${cliPackage.name} my-app`} />
            <div className="flex flex-wrap items-center gap-4">
              <CtaLink href="/builder">build your stack →</CtaLink>
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="text-muted-foreground font-mono text-sm">
              <CountUp value={registry.size} /> modules · {choiceLabels('framework').join(', ')} ·{' '}
              {PACKAGE_MANAGERS.join(', ')}
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.15}>
          <HeroFilm />
        </Reveal>
      </div>
    </section>
  )
}
