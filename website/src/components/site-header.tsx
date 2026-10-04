import { CopyCommand } from '@/components/copy-command'
import { CurvedNavbar, type CurvedNavbarItem } from '@/components/ui/curved-navbar'
import { REPOSITORY } from '@/lib/site'

import cliPackage from '@repo/package.json'

const LINKS: readonly CurvedNavbarItem[] = [
  { label: 'stack', href: '/#works-with', description: 'Everything DevStack wires.' },
  { label: 'build', href: '/#build', description: 'Pick a stack, get one command.' },
  { label: 'docs', href: '/docs', description: 'Flags, settings, every module.' },
  { label: 'mcp', href: '/docs/mcp', description: 'Use DevStack from your AI assistant.' }
]

/** The curved navbar hanging from the top of every page; opens into a link panel. */
export function SiteHeader({ stars }: { readonly stars: number | undefined }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 font-mono">
      <CurvedNavbar
        brand="devstack"
        brandHref="/"
        logo={<span className="text-sm font-bold">&gt;_</span>}
        items={LINKS}
        actionLabel={stars === undefined || stars === 0 ? '★ github' : `★ github ${stars}`}
        actionHref={REPOSITORY}
        panelHeading="Production-ready stacks, wired and verified."
        panelDescription="Pick a stack, run one command, and get a project that installs, passes its checks and boots."
        background="#0a0a0a"
        foreground="#fafafa"
        accent="#4ade80"
        compactWidth={760}
      >
        <p className="mb-3 text-[10px] tracking-[0.2em] uppercase opacity-45">try it</p>
        <CopyCommand command={`npx ${cliPackage.name} my-app`} />
      </CurvedNavbar>
    </header>
  )
}
