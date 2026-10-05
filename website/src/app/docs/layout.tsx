import Link from 'next/link'

import { docSections } from '@/lib/docs'
import { registry } from '@/lib/registry'

const linkClass = 'text-muted-foreground hover:text-foreground block py-1 text-sm transition-colors'

/** The docs: a sidebar of the README's sections, the MCP guide and the module reference. */
export default function DocsLayout({ children }: LayoutProps<'/docs'>) {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-32 pb-24 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Docs" className="lg:sticky lg:top-28 lg:self-start">
        <p className="label text-muted-foreground mb-3">guide</p>
        {docSections().map((section) => (
          <Link key={section.slug} href={`/docs#${section.slug}`} className={linkClass}>
            {section.title}
          </Link>
        ))}
        <p className="label text-muted-foreground mt-8 mb-3">reference</p>
        <Link href="/docs/mcp" className={linkClass}>
          MCP for AI assistants
        </Link>
        <Link href="/docs/modules" className={linkClass}>
          Modules ({registry.size})
        </Link>
        <a href="/schema/stack.json" className={linkClass}>
          stack.json schema
        </a>
      </nav>
      <article className="min-w-0">{children}</article>
    </div>
  )
}
