'use client'

import { motion } from 'motion/react'

import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { TextScramble } from '@/components/motion/text-scramble'
import { CHECKS } from '@/film/film-data'
import { DURATION, EASE } from '@/lib/motion'

const PROBLEMS = [
  'create-* tools hand you a hello world.',
  'Auth, a database, Docker, tests and CI are still yours to wire.',
  'Each one fights the config of the others.',
  'Nothing checks that it all works together.'
]

const PROMISES = [
  {
    title: 'Wired end to end',
    detail: 'Modules know each other: auth uses your ORM, your API docs list its routes.'
  },
  { title: 'Checked before you see it', detail: CHECKS.join(' · ') },
  {
    title: 'Yours to change',
    detail: 'Add or remove modules later; DevStack rewires the code it wrote.'
  }
]

const VIEWPORT = { once: true, margin: '-20% 0px' } as const

/** A problem line that gets struck through as it scrolls into view, each wrapped line too. */
function StruckLine({ text, index }: { readonly text: string; readonly index: number }) {
  return (
    <motion.span
      className="from-destructive/70 to-destructive/70 bg-gradient-to-r bg-no-repeat [box-decoration-break:clone] [background-position:0_55%]"
      initial={{ backgroundSize: '0% 1px' }}
      whileInView={{ backgroundSize: '100% 1px' }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.reveal, ease: EASE, delay: 0.4 + index * 0.15 }}
    >
      {text}
    </motion.span>
  )
}

/** A check mark that draws itself in. */
function DrawnCheck({ index }: { readonly index: number }) {
  return (
    <svg viewBox="0 0 16 16" className="text-primary mt-1 size-4 shrink-0" aria-hidden>
      <motion.path
        d="M2 8.5 6 12.5 14 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: DURATION.reveal, ease: EASE, delay: 0.6 + index * 0.15 }}
      />
    </svg>
  )
}

/** Section 4: what starting a project costs today, and what DevStack does instead. */
export function ProblemPromise() {
  return (
    <section className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        <TextScramble text="// the problem" className="text-muted-foreground font-mono text-sm" />
        <Stagger className="text-muted-foreground flex flex-col gap-4 text-xl">
          {PROBLEMS.map((problem, index) => (
            <StaggerItem key={problem}>
              <StruckLine text={problem} index={index} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <div className="flex flex-col gap-6">
        <TextScramble text="// devstack" className="text-primary font-mono text-sm" />
        <Stagger className="flex flex-col gap-6">
          {PROMISES.map((promise, index) => (
            <StaggerItem key={promise.title} className="flex gap-3">
              <DrawnCheck index={index} />
              <div>
                <p className="text-xl font-medium">{promise.title}</p>
                <p className="text-muted-foreground font-mono text-sm">{promise.detail}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
