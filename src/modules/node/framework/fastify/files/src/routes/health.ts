import type { FastifyPluginAsync } from 'fastify'

import { runReadiness, type ReadinessCheck } from '../lib/readiness.js'

/** GET /health is liveness and never touches dependencies; GET /ready runs every check. */
export function healthRoutes(checks: readonly ReadinessCheck[]): FastifyPluginAsync {
  return (app) => {
    app.get('/health', () => ({ status: 'ok', uptime: Math.round(process.uptime()) }))

    app.get('/ready', async (_request, reply) => {
      const { report } = await runReadiness(checks)
      return reply.status(report.status === 'ok' ? 200 : 503).send(report)
    })

    return Promise.resolve()
  }
}
