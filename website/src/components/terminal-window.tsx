import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** A macOS-style terminal window around mono content. */
export function TerminalWindow({
  title,
  className,
  children
}: {
  readonly title: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col overflow-hidden rounded-xl border shadow-[0_0_80px_-30px_var(--glow)]',
        className
      )}
    >
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span className="size-3 rounded-full bg-[#f87171]" aria-hidden />
        <span className="size-3 rounded-full bg-[#fbbf24]" aria-hidden />
        <span className="size-3 rounded-full bg-[#4ade80]" aria-hidden />
        <span className="text-muted-foreground ml-2 font-mono text-xs">{title}</span>
      </div>
      <div className="min-h-0 flex-1 p-5 font-mono text-sm">{children}</div>
    </div>
  )
}
