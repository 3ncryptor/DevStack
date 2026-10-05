import type { Metadata } from 'next'

import { CopyCommand } from '@/components/copy-command'
import { Markdown } from '@/components/docs/markdown'
import { docSubsection } from '@/lib/docs'

import cliPackage from '@repo/package.json'

export const metadata: Metadata = {
  title: 'MCP',
  description: 'Use DevStack from Claude Code, Cursor or any MCP client over its local server.'
}

/** The MCP guide: the README's setup, with the Claude Code command ready to copy. */
export default function McpDocsPage() {
  return (
    <>
      <p className="label text-primary mb-5">{'// mcp'}</p>
      <h1 className="display mb-8 text-5xl sm:text-6xl">ASK FOR A STACK.</h1>
      <div className="mb-10 max-w-xl">
        <CopyCommand command={`claude mcp add devstack -- npx ${cliPackage.name} mcp`} />
      </div>
      <Markdown source={docSubsection('Use from AI assistants (MCP)')} />
    </>
  )
}
