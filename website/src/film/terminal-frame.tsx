import type { ReactNode } from 'react'

/** A macOS-style terminal window, the film's main stage. */
export function TerminalFrame({
  title,
  children
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <div className="border-border bg-card absolute inset-6 flex flex-col overflow-hidden rounded-xl border shadow-2xl">
      <div className="border-border flex items-center gap-2 border-b px-5 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="text-muted-foreground ml-4 font-mono text-sm">{title}</span>
      </div>
      <div className="flex-1 overflow-hidden p-6 font-mono text-[19px] leading-[1.6]">
        {children}
      </div>
    </div>
  )
}
