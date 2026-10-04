import { CopyCommand } from '@/components/copy-command'
import { CtaLink } from '@/components/cta-link'
import { HeroBackdrop } from '@/components/hero/hero-backdrop'
import { HeroFilm } from '@/components/hero/hero-film'
import { ScrollCue } from '@/components/hero/scroll-cue'
import { Reveal } from '@/components/motion/reveal'

import cliPackage from '@repo/package.json'

/** Section 1: one line, the command, and the film, which does the explaining. */
export function Hero() {
  return (
    <section className="dot-grid relative overflow-hidden">
      <HeroBackdrop />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 pt-32 pb-16 text-center">
        <Reveal>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            One command. <span className="text-primary block">A production-ready stack.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.1} className="flex max-w-full flex-col items-center gap-4 sm:flex-row">
          <CopyCommand command={`npx ${cliPackage.name} my-app`} />
          <CtaLink href="#build">build your stack ↓</CtaLink>
        </Reveal>
        <div className="w-full text-left">
          <HeroFilm />
        </div>
        <ScrollCue />
      </div>
    </section>
  )
}
