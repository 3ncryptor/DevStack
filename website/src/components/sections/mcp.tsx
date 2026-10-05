'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'

import { CopyCommand } from '@/components/copy-command'
import { STATS } from '@/lib/stats'

import cliPackage from '@repo/package.json'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/** The MCP server's tools (src/mcp/server.ts). */
const TOOLS = [
  'list_modules',
  'list_presets',
  'validate',
  'plan',
  'init',
  'add_modules',
  'remove_modules'
]

const CLAUDE_CODE = `claude mcp add devstack -- npx ${cliPackage.name} mcp`
const ANY_CLIENT = JSON.stringify(
  { mcpServers: { devstack: { command: 'npx', args: [cliPackage.name, 'mcp'] } } },
  null,
  2
)

const CHAT_PRESET = STATS.presets.find((preset) => preset.name === 'backend-nest')

/** The scripted conversation: an assistant using the real tools on the real backend-nest preset. */
const CHAT = [
  { who: 'you', text: 'Create a NestJS API with Postgres and JWT auth in ~/code/api' },
  { who: 'tool', text: `list_presets → ${STATS.presets.length} presets` },
  {
    who: 'tool',
    text: `plan { name: "api", preset: "backend-nest" } → ${CHAT_PRESET?.files} files, ${CHAT_PRESET?.modules} modules, no conflicts`
  },
  {
    who: 'tool',
    text: 'init { name: "api", preset: "backend-nest", directory: "/Users/you/code/api" } → generated, installed'
  },
  { who: 'assistant', text: `Done: ${CHAT_PRESET?.description}.` }
] as const

const TABS = ['Claude Code', 'Any MCP client'] as const

/** Section: DevStack from your AI assistant, over its local MCP server. */
export function Mcp() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Claude Code')
  const chat = useRef<HTMLOListElement>(null)

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-line]', {
          autoAlpha: 0,
          y: 16,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.45,
          scrollTrigger: { trigger: chat.current, start: 'top 75%' }
        })
      })
    },
    { scope: chat }
  )

  return (
    <section aria-labelledby="mcp-title" className="mx-auto max-w-6xl px-6 py-28">
      <p className="label text-primary mb-5">{'// use it from your ai assistant'}</p>
      <h2 id="mcp-title" className="display mb-14 text-5xl sm:text-7xl">
        ASK FOR A STACK.
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-card flex flex-col gap-6 rounded-2xl border p-6 sm:p-8">
          <p className="text-muted-foreground text-sm">
            <code className="font-mono">{cliPackage.name} mcp</code> is a local MCP server over
            stdio: your assistant starts it, nothing is hosted.
          </p>
          <div role="tablist" className="border-border flex gap-1 rounded-lg border p-1">
            {TABS.map((name) => (
              <button
                key={name}
                role="tab"
                type="button"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className="relative flex-1 rounded-md px-3 py-2 font-mono text-xs"
              >
                {tab === name && (
                  <motion.span
                    layoutId="mcp-tab"
                    className="bg-muted absolute inset-0 rounded-md"
                  />
                )}
                <span className="relative">{name}</span>
              </button>
            ))}
          </div>
          {tab === 'Claude Code' ? (
            <CopyCommand command={CLAUDE_CODE} />
          ) : (
            <pre className="border-border bg-background overflow-x-auto rounded-lg border p-4 font-mono text-xs">
              {ANY_CLIENT}
            </pre>
          )}
          <div>
            <p className="label text-muted-foreground mb-3">tools</p>
            <ul className="flex flex-wrap gap-2">
              {TOOLS.map((tool) => (
                <li
                  key={tool}
                  className="border-border rounded-md border px-2.5 py-1 font-mono text-xs"
                >
                  {tool}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ol
          ref={chat}
          aria-label="An example conversation"
          className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-6 font-mono text-sm sm:p-8"
        >
          {CHAT.map((line, index) => (
            <li
              key={index}
              data-line
              className={
                line.who === 'you'
                  ? 'bg-muted self-end rounded-xl px-4 py-3'
                  : line.who === 'tool'
                    ? 'text-muted-foreground border-primary/40 border-l-2 pl-4 text-xs'
                    : 'text-foreground'
              }
            >
              {line.who === 'tool' && <span className="text-primary">⚙ </span>}
              {line.text}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
