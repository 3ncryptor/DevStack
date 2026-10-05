import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { slugOf } from '@/lib/docs'
import { REPOSITORY } from '@/lib/site'

/** README links are relative to the repository; on the site they point at GitHub. */
const linkTarget = (href = ''): string =>
  /^(https?:|mailto:|#|\/)/.test(href) ? href : `${REPOSITORY}/blob/main/${href}`

const text = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(text).join('')
    : typeof children === 'string'
      ? children
      : ''

/** README markdown in the site's type: anchored headings, mono code, readable tables. */
const COMPONENTS: Components = {
  h3: ({ children }) => (
    <h3 id={slugOf(text(children))} className="mt-12 mb-4 scroll-mt-28 text-xl font-semibold">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="text-muted-foreground my-4 leading-relaxed">{children}</p>,
  a: ({ href, children }) => (
    <a href={linkTarget(href)} className="text-primary underline-offset-4 hover:underline">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="text-muted-foreground my-4 flex list-disc flex-col gap-2 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-muted-foreground my-4 flex list-decimal flex-col gap-2 pl-5">{children}</ol>
  ),
  code: ({ children }) => (
    <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="border-border bg-card my-6 overflow-x-auto rounded-xl border p-5 font-mono text-[13px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="border-border my-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-border bg-card label text-muted-foreground border-b px-4 py-3">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border text-muted-foreground border-b px-4 py-3 align-top">{children}</td>
  )
}

export function Markdown({ source }: { readonly source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {source}
    </ReactMarkdown>
  )
}
