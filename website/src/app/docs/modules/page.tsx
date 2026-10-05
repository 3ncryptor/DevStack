import type { Metadata } from 'next'
import Link from 'next/link'

import { BrandLogo } from '@/components/brand-logo'
import { MODULE_LOGOS } from '@/lib/logos'
import { registry } from '@/lib/registry'

export const metadata: Metadata = {
  title: 'Modules',
  description: `All ${registry.size} DevStack modules: what each wires in, needs and conflicts with.`
}

/** The modules by category, in registry order: every one links to its reference page. */
function byCategory() {
  const groups = new Map<string, Array<{ id: string; title: string; description: string }>>()
  for (const { id, title, description, category } of registry.values()) {
    groups.set(category, [...(groups.get(category) ?? []), { id, title, description }])
  }
  return [...groups]
}

export default function ModulesPage() {
  return (
    <>
      <p className="label text-primary mb-5">{'// modules'}</p>
      <h1 className="display mb-12 text-5xl sm:text-6xl">{registry.size} MODULES.</h1>
      {byCategory().map(([category, modules]) => (
        <section key={category} className="mb-12">
          <h2 className="label text-muted-foreground mb-4">{category}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {modules.map((module) => {
              const logo = MODULE_LOGOS[module.id]
              return (
                <li key={module.id}>
                  <Link
                    href={`/docs/modules/${module.id}`}
                    className="border-border bg-card flex h-full gap-4 rounded-xl border p-4 transition-colors hover:border-white/20"
                  >
                    {logo !== undefined && (
                      <BrandLogo icon={logo} className="mt-1 size-5 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium">{module.title}</span>
                      <span className="text-muted-foreground block font-mono text-xs">
                        {module.id}
                      </span>
                      <span className="text-muted-foreground mt-2 line-clamp-2 block text-sm">
                        {module.description}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
