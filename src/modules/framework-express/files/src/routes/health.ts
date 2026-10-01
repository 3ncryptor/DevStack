import { Router } from 'express'

import { runReadiness, type ReadinessCheck } from '../lib/readiness.js'

/** GET /health is liveness and never touches dependencies; GET /ready runs every check. */
export function createHealthRouter(checks: readonly ReadinessCheck[]): Router {
  const router = Router()

  router.get('/health', (_request, response) => {
    response.json({ status: 'ok', uptime: Math.round(process.uptime()) })
  })

  router.get('/ready', (_request, response, next) => {
    runReadiness(checks).then(({ report }) => {
      response.status(report.status === 'ok' ? 200 : 503).json(report)
    }, next)
  })

  return router
}
