import type { Metadata } from 'next'

import { Markdown } from '@/components/docs/markdown'
import { docSections } from '@/lib/docs'

export const metadata: Metadata = {
  title: 'Docs',
  description: 'Commands, flags, the stack config, add and remove, presets and MCP.'
}

/** The guide: the README's sections, each with an anchor the sidebar links to. */
export default function DocsPage() {
  return (
    <>
      <p className="label text-primary mb-5">{'// docs'}</p>
      <h1 className="display mb-12 text-5xl sm:text-6xl">THE GUIDE.</h1>
      {docSections().map((section) => (
        <section key={section.slug} id={section.slug} className="mb-16 scroll-mt-28">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight">{section.title}</h2>
          <Markdown source={section.markdown} />
        </section>
      ))}
    </>
  )
}
