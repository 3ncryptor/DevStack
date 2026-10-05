'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

import type { Shell } from '@repo/src/browser'

import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

import cliPackage from '@repo/package.json'

const SHELL_TABS: ReadonlyArray<{ shell: Shell; label: string }> = [
  { shell: 'posix', label: 'macOS / Linux' },
  { shell: 'powershell', label: 'Windows (PowerShell)' }
]
const COPIED_MS = 1500

/** The one command for the stack, per shell; Windows visitors start on PowerShell. */
export function FinalCommand({
  command,
  shareLink
}: {
  readonly command: Readonly<Record<Shell, string>>
  readonly shareLink: () => string
}) {
  // Windows visitors start on PowerShell (the builder renders in the browser only)
  const [shell, setShell] = useState<Shell>(() =>
    navigator.userAgent.includes('Windows') ? 'powershell' : 'posix'
  )
  const [copied, setCopied] = useState<'command' | 'link'>()

  const copy = async (what: 'command' | 'link', text: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(undefined), COPIED_MS)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Shell"
        className="border-border flex gap-1 rounded-lg border p-1"
      >
        {SHELL_TABS.map((tab) => (
          <button
            key={tab.shell}
            role="tab"
            type="button"
            aria-selected={shell === tab.shell}
            onClick={() => setShell(tab.shell)}
            className="relative flex-1 rounded-md px-3 py-2 font-mono text-xs"
          >
            {shell === tab.shell && (
              <motion.span layoutId="shell-tab" className="bg-muted absolute inset-0 rounded-md" />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.pre
          key={command[shell]}
          initial={{ opacity: 0.4, boxShadow: '0 0 0 1px var(--primary)' }}
          animate={{ opacity: 1, boxShadow: '0 0 0 1px var(--border)' }}
          transition={{ duration: DURATION.reveal, ease: EASE }}
          className="bg-background rounded-xl p-4 font-mono text-[13px] leading-relaxed break-all whitespace-pre-wrap"
        >
          <span className="text-primary select-none">{shell === 'powershell' ? '> ' : '$ '}</span>
          {command[shell]}
        </motion.pre>
      </AnimatePresence>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void copy('command', command[shell])}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 font-mono text-sm font-semibold transition-transform hover:-translate-y-0.5"
        >
          {copied === 'command' ? '✓ copied' : 'copy command'}
        </button>
        <button
          type="button"
          onClick={() => void copy('link', shareLink())}
          className={cn(
            'border-border rounded-lg border px-4 py-2.5 font-mono text-sm transition-colors',
            copied === 'link' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {copied === 'link' ? '✓ link copied' : 'share this stack'}
        </button>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        needs Node.js {cliPackage.engines.node} · installs, checks and boots the project for you
      </p>
    </div>
  )
}
