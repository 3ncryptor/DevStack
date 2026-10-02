import scalar from '@scalar/fastify-api-reference'
import type { FastifyInstance } from 'fastify'

import { openApiDocument } from '../docs/openapi.js'

/** Always in development; in production only with API_DOCS=true. */
export const docsEnabled = process.env.NODE_ENV !== 'production' || process.env.API_DOCS === 'true'

/** GET /openapi.json, and the Scalar API reference at /docs. */
export async function registerDocs(app: FastifyInstance): Promise<void> {
  app.get('/openapi.json', () => openApiDocument)
  await app.register(scalar, { routePrefix: '/docs', configuration: { url: '/openapi.json' } })
}
