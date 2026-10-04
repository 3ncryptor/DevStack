import Link from 'next/link'

import { NPM_PACKAGE, REPOSITORY } from '@/lib/site'

import { Wordmark } from './wordmark'

const LINKS = [
  { label: 'build', href: '/#build' },
  { label: 'docs', href: '/docs' },
  { label: 'mcp', href: '/docs/mcp' }
]

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 font-mono text-xs">
        <div className="flex items-center gap-6">
          <Wordmark />
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a href={REPOSITORY} className="hover:text-foreground transition-colors">
            github
          </a>
          <a href={NPM_PACKAGE} className="hover:text-foreground transition-colors">
            npm
          </a>
        </div>
        <p>MIT · built with DevStack&apos;s own code</p>
      </div>
    </footer>
  )
}
