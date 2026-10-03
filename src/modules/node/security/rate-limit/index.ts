import { z } from 'zod'

import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'http:fastify' }
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'security-rate-limit',
  title: 'Rate limiting',
  category: 'security',
  language: 'node',
  wizard: { question: 'appSetup', order: 3, checked: true },
  description:
    'API rate limiting for Express or NestJS: fixed window, sliding window, token or leaky bucket',
  requiresAny: ['http:connect', 'http:fastify'],
  // the middleware is typed with Express types, which Nest does not bring in on its own
  devDependencies: [{ name: '@types/express', when: CONNECT }],
  slots: [
    {
      slot: 'app.imports',
      code: "import { apiRateLimiter } from './middlewares/rate-limit.js'",
      when: CONNECT
    },
    { slot: 'app.middleware', code: 'app.use(apiRateLimiter)', order: 60, when: CONNECT },
    {
      slot: 'app.imports',
      code: "import { registerRateLimit } from './plugins/rate-limit.js'",
      when: FASTIFY
    },
    { slot: 'app.plugins', code: 'registerRateLimit(app)', order: 60, when: FASTIFY }
  ],
  options: z.strictObject({
    /** How requests are counted (D-64); all keep state in memory, per process. */
    algorithm: z
      .enum(['fixed-window', 'sliding-window', 'token-bucket', 'leaky-bucket'])
      .default('fixed-window'),
    /** Length of the rate-limit window in milliseconds. */
    windowMs: z
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    /** Requests allowed per client in each window (the bucket size for the bucket algorithms). */
    limit: z.number().int().positive().default(100)
  }),
  files: [
    { path: 'src/middlewares/rate-limit.ts', when: CONNECT },
    { path: 'src/plugins/rate-limit.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/security/rate-limit')
}

export default moduleDefinition
