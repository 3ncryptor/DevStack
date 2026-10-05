'use client'

import { AnimatePresence, motion } from 'motion/react'

import { ALWAYS_INCLUDED_LABEL } from '@repo/src/browser'

import { BrandLogo } from '@/components/brand-logo'
import { FinalCommand } from '@/components/builder/final-command'
import { QuestionField } from '@/components/builder/question-field'
import { MODULE_LOGOS } from '@/lib/logos'
import { DURATION, EASE } from '@/lib/motion'
import { registry } from '@/lib/registry'
import { useBuilder, type BuiltStack } from '@/lib/use-builder'

/** The live stack: the modules the answers resolve to, and whether they fit together. */
function StackSummary({ stack }: { readonly stack: BuiltStack }) {
  const problems = stack.diagnostics.length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <p className="label text-muted-foreground">your stack</p>
        <p className="font-mono text-xs">
          <span className="display text-2xl">{stack.modules.length}</span> modules
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {stack.modules.map((id) => {
            const logo = MODULE_LOGOS[id]
            return (
              <motion.li
                key={id}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: DURATION.ui, ease: EASE }}
                className="border-border bg-background flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
              >
                {logo !== undefined && <BrandLogo icon={logo} className="size-3" />}
                {registry.get(id)?.title ?? id}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      <p
        className={
          problems === 0 ? 'text-primary font-mono text-xs' : 'text-destructive font-mono text-xs'
        }
      >
        {problems === 0
          ? '✓ resolves cleanly: no conflicts, nothing missing'
          : stack.diagnostics.map((diagnostic) => diagnostic.message).join(' · ')}
      </p>
      <p className="text-muted-foreground font-mono text-[11px]">
        always included: {ALWAYS_INCLUDED_LABEL}
      </p>
    </div>
  )
}

/** Section: the GUI for DevStack. Answer the CLI's own questions here, leave with one command. */
export function Builder() {
  const builder = useBuilder()
  const { stack } = builder

  return (
    <section
      id="build"
      aria-labelledby="build-title"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-28"
    >
      <p className="label text-primary mb-5">{'// build your stack'}</p>
      <h2 id="build-title" className="display mb-4 text-5xl sm:text-7xl">
        BUILD IT HERE.
      </h2>
      <p className="text-muted-foreground mb-14 max-w-2xl">
        The same questions the CLI asks, with the same rules: only choices that fit your stack are
        offered. Leave with one command; it answers the wizard for you.
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
          <label className="mb-8 flex flex-col gap-3">
            <span className="label text-muted-foreground">project name</span>
            <input
              value={builder.name}
              onChange={(event) => builder.setName(event.target.value)}
              spellCheck={false}
              className="border-border bg-background focus:border-primary rounded-lg border px-4 py-3 font-mono text-sm transition-colors outline-none"
            />
          </label>
          {stack === undefined ? (
            <p className="text-muted-foreground font-mono text-sm">loading the questions…</p>
          ) : (
            stack.questions.map((question) => (
              <QuestionField
                key={question.key}
                question={question}
                onAnswer={(value) => builder.pick(question.key, value)}
              />
            ))
          )}
          <button
            type="button"
            onClick={builder.reset}
            className="text-muted-foreground hover:text-foreground mt-4 font-mono text-xs transition-colors"
          >
            ↺ start over with the defaults
          </button>
        </div>

        <div className="border-border bg-card flex flex-col gap-8 rounded-2xl border p-6 sm:p-8 lg:sticky lg:top-24">
          {stack !== undefined && (
            <>
              <StackSummary stack={stack} />
              <div className="border-border border-t pt-8">
                <p className="label text-primary mb-4">run it</p>
                <FinalCommand command={stack.command} shareLink={builder.shareLink} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
