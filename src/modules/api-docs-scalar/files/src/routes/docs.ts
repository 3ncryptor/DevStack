import { apiReference } from '@scalar/express-api-reference'
import { Router, type RequestHandler } from 'express'

import { openApiDocument } from '../docs/openapi.js'

/** Always in development; in production only with API_DOCS=true. */
export const docsEnabled = process.env.NODE_ENV !== 'production' || process.env.API_DOCS === 'true'

/** GET /openapi.json, and the Scalar API reference at /docs. */
export function createDocsRouter(): Router {
  const router = Router()
  router.get('/openapi.json', (_request, response) => {
    response.json(openApiDocument)
  })
  // Scalar types its handler with `never` route params; it reads none
  router.use('/docs', apiReference({ url: '/openapi.json' }) as unknown as RequestHandler)
  return router
}
