'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import { DURATION, EASE } from '@/lib/motion'

const COPIED_MS = 1500

/** A shell command with a copy button that morphs to "✓ copied": how commands are offered. */
export function CopyCommand({ command }: { readonly command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="border-border bg-card hover:border-primary/40 flex max-w-full min-w-0 items-center gap-3 rounded-lg border px-4 py-3 font-mono text-sm transition-colors">
      <span aria-hidden className="text-primary select-none">
        $
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring relative w-16 shrink-0 text-right text-xs focus-visible:outline"
        aria-label={`Copy: ${command}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'copied' : 'copy'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.micro, ease: EASE }}
            className={copied ? 'text-primary' : undefined}
          >
            {copied ? '✓ copied' : 'copy'}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}
