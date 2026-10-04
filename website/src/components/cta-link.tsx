import Link from 'next/link'
import type { ReactNode } from 'react'

import { Magnetic } from '@/components/motion/magnetic'

/** The primary call to action: a magnetic, green link. */
export function CtaLink({
  href,
  children
}: {
  readonly href: string
  readonly children: ReactNode
}) {
  return (
    <Magnetic>
      <Link
        href={href}
        className="bg-primary text-primary-foreground focus-visible:outline-ring inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-mono text-sm font-semibold transition-transform hover:shadow-[0_0_30px_var(--glow)] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97]"
      >
        {children}
      </Link>
    </Magnetic>
  )
}
