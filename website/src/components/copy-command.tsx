'use client'

import { useState } from 'react'

const COPIED_MS = 1500

/** A shell command with a copy button: the way every command on the site is offered. */
export function CopyCommand({ command }: { readonly command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-md border px-4 py-3 font-mono text-sm">
      <span aria-hidden className="text-primary select-none">
        $
      </span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring shrink-0 text-xs focus-visible:outline"
        aria-label={`Copy: ${command}`}
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  )
}
