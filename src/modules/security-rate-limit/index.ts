import { z } from 'zod'

import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'security-rate-limit',
  title: 'Rate limiting',
  category: 'security',
  language: 'node',
  description: 'API rate limiting middleware for Express or NestJS',
  requiresAny: ['http-framework'],
  dependencies: ['express-rate-limit'],
  // its types reference express types, which Nest does not bring in on its own
  devDependencies: ['@types/express'],
  slots: [
    { slot: 'app.imports', code: "import { apiRateLimiter } from './middlewares/rate-limit.js'" },
    { slot: 'app.middleware', code: 'app.use(apiRateLimiter)', order: 60 }
  ],
  options: z.strictObject({
    /** Length of the rate-limit window in milliseconds. */
    windowMs: z
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    /** Requests allowed per client in each window. */
    limit: z.number().int().positive().default(100)
  }),
  filesPath: moduleFilesPath('security-rate-limit')
}

export default moduleDefinition
