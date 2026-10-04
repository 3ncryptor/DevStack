'use client'

import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { GooeyNav } from '@/components/ui/gooey-nav'
import { DURATION, EASE } from '@/lib/motion'
import { REPOSITORY } from '@/lib/site'

import { Wordmark } from './wordmark'

const LINKS = [
  { label: 'home', href: '/' },
  { label: 'builder', href: '/builder' },
  { label: 'docs', href: '/docs' },
  { label: 'mcp', href: '/docs/mcp' }
]
const GLASS_AFTER_PX = 24

/** The link whose path is the longest prefix of the current one, e.g. /docs/mcp → mcp. */
function activeIndex(pathname: string): number {
  const matches = LINKS.map((link, index) => ({ index, href: link.href })).filter(
    ({ href }) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
  )
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.index ?? 0
}

export function SiteHeader({ stars }: { readonly stars: number | undefined }) {
  const pathname = usePathname()
  const { scrollY } = useScroll()
  const [glass, setGlass] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setGlass(y > GLASS_AFTER_PX))

  return (
    <motion.header
      className="sticky top-0 z-50 border-b"
      animate={{
        backgroundColor: glass ? 'rgb(10 11 13 / 0.7)' : 'rgb(10 11 13 / 0)',
        borderColor: glass ? 'var(--border)' : 'rgb(0 0 0 / 0)',
        backdropFilter: glass ? 'blur(12px)' : 'blur(0px)'
      }}
      transition={{ duration: DURATION.ui, ease: EASE }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Link href="/" aria-label="DevStack home">
          <Wordmark />
        </Link>
        <GooeyNav
          items={LINKS}
          value={activeIndex(pathname)}
          size="sm"
          variant="glow"
          activeColor="#4ade80"
          activeLabelColor="#0a0b0d"
          className="font-mono max-sm:hidden"
        />
        <a
          href={REPOSITORY}
          className="text-muted-foreground hover:text-foreground font-mono text-sm transition-colors"
        >
          ★ github{stars === undefined || stars === 0 ? '' : ` ${stars}`}
        </a>
      </nav>
    </motion.header>
  )
}
