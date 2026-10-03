import type { DevstackModule, EnvDeclaration } from '../../../types/module'

interface DatabaseSpec {
  id: string
  title: string
  description: string
  /** Capability tags, e.g. `db:postgres` and `db:sql`, which ORMs require. */
  provides: readonly string[]
  url: Omit<EnvDeclaration, 'name' | 'required'>
  /** A compose service named `db` (devops-docker); SQLite is a file and has none. */
  hasComposeService: boolean
  /** Files to add, e.g. .gitignore lines for a file database. */
  filesPath?: string
}

/**
 * A database choice (M4, D-77): the connection URL and, with docker, the compose service and its
 * db:up/db:down scripts. The ORM picks the driver for it.
 */
export function databaseModule(spec: DatabaseSpec): DevstackModule {
  return {
    id: spec.id,
    title: spec.title,
    category: 'database',
    language: 'node',
    depth: 'bare',
    description: spec.description,
    requires: ['language-node'],
    provides: spec.provides,
    scripts: spec.hasComposeService
      ? [
          { name: 'db:up', run: 'docker compose up -d db', when: { has: 'devops-docker' } },
          { name: 'db:down', run: 'docker compose down', when: { has: 'devops-docker' } }
        ]
      : [],
    env: [{ name: 'DATABASE_URL', required: true, ...spec.url }],
    ...(spec.filesPath === undefined ? {} : { filesPath: spec.filesPath })
  }
}
