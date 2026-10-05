import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import type { DevstackModule } from '@repo/src/browser'

import { BrandLogo } from '@/components/brand-logo'
import { CopyCommand } from '@/components/copy-command'
import { MODULE_LOGOS } from '@/lib/logos'
import { registry } from '@/lib/registry'

import cliPackage from '@repo/package.json'

/** Every module page is built ahead; an unknown id is a 404. */
export const dynamicParams = false

export function generateStaticParams(): Array<{ id: string }> {
  return [...registry.keys()].map((id) => ({ id }))
}

type SiteModule = DevstackModule & { optionsSchema?: { properties?: Record<string, OptionSchema> } }

interface OptionSchema {
  type?: string
  default?: unknown
  enum?: readonly unknown[]
  description?: string
}

const definitionOf = async (params: Promise<{ id: string }>): Promise<SiteModule> => {
  const definition = registry.get((await params).id) as SiteModule | undefined
  if (definition === undefined) notFound()
  return definition
}

export async function generateMetadata({
  params
}: PageProps<'/docs/modules/[id]'>): Promise<Metadata> {
  const definition = await definitionOf(params)
  return { title: definition.title, description: definition.description }
}

function ModuleLinks({ label, ids }: { readonly label: string; readonly ids?: readonly string[] }) {
  if (ids === undefined || ids.length === 0) return null
  return (
    <div>
      <p className="label text-muted-foreground mb-3">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <li key={id}>
            {/* a module id links to its page; a capability such as http:connect is just named */}
            {registry.has(id) ? (
              <Link
                href={`/docs/modules/${id}`}
                className="border-border hover:text-primary rounded-md border px-2.5 py-1 font-mono text-xs transition-colors"
              >
                {id}
              </Link>
            ) : (
              <span className="border-border text-muted-foreground rounded-md border border-dashed px-2.5 py-1 font-mono text-xs">
                {id}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A module's reference: what it needs, conflicts with, its options and environment. */
export default async function ModulePage({ params }: PageProps<'/docs/modules/[id]'>) {
  const definition = await definitionOf(params)
  const logo = MODULE_LOGOS[definition.id]
  const options = Object.entries(definition.optionsSchema?.properties ?? {})

  return (
    <>
      <Link href="/docs/modules" className="label text-muted-foreground hover:text-foreground">
        ← modules / {definition.category}
      </Link>
      <div className="mt-6 mb-4 flex items-center gap-4">
        {logo !== undefined && <BrandLogo icon={logo} className="size-10" />}
        <h1 className="text-4xl font-semibold tracking-tight">{definition.title}</h1>
      </div>
      <p className="text-muted-foreground mb-2 font-mono text-sm">{definition.id}</p>
      <p className="text-muted-foreground mb-10 max-w-2xl text-lg">{definition.description}</p>

      <div className="mb-10 max-w-xl">
        <p className="label text-muted-foreground mb-3">add it to a devstack project</p>
        <CopyCommand command={`npx ${cliPackage.name} add ${definition.id}`} />
      </div>

      <div className="mb-10 flex flex-col gap-6">
        <ModuleLinks label="requires" ids={definition.requires} />
        <ModuleLinks label="requires one of" ids={definition.requiresAny} />
        <ModuleLinks label="conflicts with" ids={definition.conflictsWith} />
      </div>

      {options.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">Options</h2>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="label text-muted-foreground">
                  <th className="border-border border-b px-4 py-3">option</th>
                  <th className="border-border border-b px-4 py-3">values</th>
                  <th className="border-border border-b px-4 py-3">default</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {options.map(([name, option]) => (
                  <tr key={name}>
                    <td className="border-border border-b px-4 py-3">{name}</td>
                    <td className="border-border text-muted-foreground border-b px-4 py-3">
                      {option.enum?.join(' · ') ?? option.type ?? '—'}
                    </td>
                    <td className="border-border text-muted-foreground border-b px-4 py-3">
                      {option.default === undefined ? '—' : JSON.stringify(option.default)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 font-mono text-xs">
            set with --option {definition.id}.&lt;option&gt;=&lt;value&gt;
          </p>
        </section>
      )}

      {(definition.env ?? []).length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Environment</h2>
          <ul className="flex flex-col gap-3">
            {(definition.env ?? []).map((variable) => (
              <li key={variable.name} className="border-border bg-card rounded-xl border p-4">
                <p className="font-mono text-sm">
                  {variable.name}
                  {variable.required && <span className="text-primary"> · required</span>}
                  {variable.secret === true && (
                    <span className="text-muted-foreground"> · secret</span>
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">{variable.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
