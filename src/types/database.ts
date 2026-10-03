import { z } from 'zod'

export const SQL_DIALECTS = ['postgresql', 'mysql', 'sqlite'] as const
export type SqlDialect = (typeof SQL_DIALECTS)[number]

/**
 * How docker-compose.yml runs a database next to the app: as its own `db` service, or, for a file
 * database, as a file on a volume the app mounts at `dataDir`. `url` is DATABASE_URL in there;
 * `definition` holds the service's YAML lines, relative to the service.
 */
export type DatabaseCompose =
  | { kind: 'service'; url: string; volume: string; definition: readonly string[] }
  | { kind: 'file'; url: string; volume: string; dataDir: string }

/** What a database tells the modules that use it: ORMs, Docker (D-96). Templates read `it.database`. */
export interface DatabaseTraits {
  /** For ORMs; a document store has none. */
  dialect?: SqlDialect
  compose: DatabaseCompose
}

export const databaseTraitsSchema = z.strictObject({
  dialect: z.enum(SQL_DIALECTS).optional(),
  compose: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('service'),
      url: z.string().min(1),
      volume: z.string().min(1),
      definition: z.array(z.string()).min(1)
    }),
    z.strictObject({
      kind: z.literal('file'),
      url: z.string().min(1),
      volume: z.string().min(1),
      dataDir: z.string().startsWith('/')
    })
  ])
})
