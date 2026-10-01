import { z } from 'zod'

import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'security-rate-limit',
  title: 'Rate limiting',
  category: 'security',
  language: 'node',
  description:
    'API rate limiting for Express or NestJS: fixed window, sliding window, token or leaky bucket',
  requiresAny: ['http-framework'],
  // the middleware is typed with Express types, which Nest does not bring in on its own
  devDependencies: ['@types/express'],
  slots: [
    { slot: 'app.imports', code: "import { apiRateLimiter } from './middlewares/rate-limit.js'" },
    { slot: 'app.middleware', code: 'app.use(apiRateLimiter)', order: 60 }
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
  filesPath: moduleFilesPath('security-rate-limit')
}

export default moduleDefinition
