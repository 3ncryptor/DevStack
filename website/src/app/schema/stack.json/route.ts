import schema from '@/generated/schema.json'

/** Built once: the schema comes from DevStack's own zod schema at build time (npm run data). */
export const dynamic = 'force-static'

/**
 * The hosted `$schema` for stack.json and --config files, so editors complete and check them:
 * `{ "$schema": "https://<site>/schema/stack.json", ... }`.
 */
export function GET(): Response {
  return Response.json(schema, { headers: { 'content-type': 'application/schema+json' } })
}
