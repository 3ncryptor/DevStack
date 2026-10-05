'use client'

import type { PointerEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** A bento tile with a soft green glow that follows the pointer across it. */
export function SpotlightCard({
  className,
  children
}: {
  readonly className?: string
  readonly children: ReactNode
}) {
  const follow = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--x', `${event.clientX - box.left}px`)
    event.currentTarget.style.setProperty('--y', `${event.clientY - box.top}px`)
  }

  return (
    <div
      onPointerMove={follow}
      className={cn(
        'group border-border bg-card relative overflow-hidden rounded-2xl border p-6 transition-colors hover:border-white/15 sm:p-8',
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), rgb(74 222 128 / 0.08), transparent 60%)'
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
