'use client'

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useRef, useState, type ComponentType } from 'react'

import { SectionHeading } from '@/components/section-heading'
import {
  EvolvePanel,
  GeneratePanel,
  PickPanel,
  VerifyPanel
} from '@/components/sections/story-panels'
import { FILM_DATA } from '@/film/film-data'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface StoryStep {
  readonly title: string
  readonly detail: string
  readonly Panel: ComponentType
}

const STORY: readonly StoryStep[] = [
  {
    title: 'Pick',
    detail:
      'Answer a few questions, or pass --modules. Only choices that fit your stack are offered.',
    Panel: PickPanel
  },
  {
    title: 'Generate',
    detail: `One plan, every file: ${FILM_DATA.files.length} for this stack, already wired to each other.`,
    Panel: GeneratePanel
  },
  {
    title: 'Verify',
    detail:
      'It installs, runs the project’s own checks and boots it, and says plainly if anything fails.',
    Panel: VerifyPanel
  },
  {
    title: 'Evolve',
    detail:
      'Add or remove modules later. DevStack rewires the code it wrote and leaves your edits alone.',
    Panel: EvolvePanel
  }
]

const stepOf = (progress: number): number =>
  Math.min(STORY.length - 1, Math.floor(progress * STORY.length))

/** Section 5: the four steps, pinned while the page scrolls through them. */
export function HowItWorks() {
  const track = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (progress) => setActive(stepOf(progress)))

  const scrollToStep = (index: number): void => {
    const element = track.current
    if (element === null) return
    const travel = element.offsetHeight - window.innerHeight
    const top = element.offsetTop + (travel * (index + 0.5)) / STORY.length
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const { detail, Panel } = STORY[active] ?? STORY[0]

  return (
    <section ref={track} className="relative" style={{ height: `${STORY.length * 100}vh` }}>
      <div className="sticky top-0 mx-auto flex h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-20">
        <SectionHeading
          eyebrow="how it works"
          title="From one command to a project you can ship."
        />
        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_1fr] gap-6 lg:grid-cols-[2fr_3fr] lg:grid-rows-1 lg:gap-8">
          <ol className="relative flex gap-2 lg:flex-col lg:gap-6">
            <motion.span
              aria-hidden
              className="bg-primary absolute top-0 left-0 hidden h-full w-px origin-top lg:block"
              style={{ scaleY: scrollYProgress }}
            />
            {STORY.map((step, index) => (
              <li key={step.title} className="flex-1 lg:flex-none">
                <button
                  type="button"
                  onClick={() => scrollToStep(index)}
                  aria-current={index === active ? 'step' : undefined}
                  className={cn(
                    'w-full text-left transition-opacity duration-300 lg:pl-6',
                    index === active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                  )}
                >
                  <span className="text-primary font-mono text-sm">0{index + 1}</span>
                  <span className="ml-2 text-base font-medium lg:ml-3 lg:text-lg">
                    {step.title}
                  </span>
                  <span className="text-muted-foreground mt-1 hidden text-sm lg:block">
                    {step.detail}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm lg:hidden">{detail}</p>
          <div className="relative min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="absolute inset-0"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: DURATION.ui, ease: EASE }}
              >
                <Panel />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
