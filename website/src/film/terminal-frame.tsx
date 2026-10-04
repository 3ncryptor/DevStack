import type { ReactNode } from 'react'

/** A macOS-style terminal window, the film's main stage, above the caption band. */
export function TerminalFrame({
  title,
  children
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <div className="border-border bg-card absolute top-[64px] left-1/2 flex h-[740px] w-[1480px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border shadow-[0_0_160px_-40px_var(--glow)]">
      <div className="border-border flex items-center gap-3 border-b px-7 py-5">
        <span className="size-4 rounded-full bg-[#ff5f57]" />
        <span className="size-4 rounded-full bg-[#febc2e]" />
        <span className="size-4 rounded-full bg-[#28c840]" />
        <span className="text-muted-foreground ml-5 font-mono text-2xl">{title}</span>
      </div>
      <div className="flex-1 overflow-hidden px-10 py-8 font-mono text-[32px] leading-[1.55]">
        {children}
      </div>
    </div>
  )
}
