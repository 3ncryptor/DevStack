import Link from 'next/link'

import { Wordmark } from './wordmark'

const REPOSITORY = 'https://github.com/3ncryptor/DevStack'

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="DevStack home">
          <Wordmark />
        </Link>
        <a href={REPOSITORY} className="text-muted hover:text-foreground font-mono text-sm">
          github
        </a>
      </nav>
    </header>
  )
}
