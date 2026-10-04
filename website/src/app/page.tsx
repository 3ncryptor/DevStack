import { PACKAGE_MANAGERS } from '@repo/src/browser'

import { CopyCommand } from '@/components/copy-command'
import { choiceLabels, registry } from '@/lib/registry'

import cliPackage from '@repo/package.json'

export default function Home() {
  const frameworks = choiceLabels('framework').join(', ')

  return (
    <section className="dot-grid">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-24">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Production-ready stacks, <span className="text-accent">wired and verified</span>.
        </h1>
        <p className="text-muted max-w-2xl text-lg">
          Pick a stack, run one command, and get a project that installs, passes its own checks and
          boots before it is handed to you.
        </p>
        <div className="max-w-xl">
          <CopyCommand command={`npx ${cliPackage.name} my-app`} />
        </div>
        <p className="text-muted font-mono text-sm">
          {registry.size} modules · {frameworks} · {PACKAGE_MANAGERS.join(', ')}
        </p>
      </div>
    </section>
  )
}
