import { Router } from 'express'
import { fromNodeHeaders } from 'better-auth/node'

import { ApiSuccess } from '../../lib/api-response.js'
import { UnauthorizedError } from '../../lib/errors.js'
import type { Auth } from './auth.js'

/**
 * GET /me: the current user in the API's own envelope. Sign-up, sign-in, sign-out and OAuth are
 * Better Auth's own routes under /auth (see auth.ts).
 */
export function createAuthRouter(auth: Auth): Router {
  const router = Router()

  router.get('/me', (request, response, next) => {
    auth.api.getSession({ headers: fromNodeHeaders(request.headers) }).then((session) => {
      if (session === null) {
        next(new UnauthorizedError())
        return
      }
      const { id, email, name, role } = session.user
      response.json(
        new ApiSuccess({
          user: { id, email, name, role: role === 'admin' ? 'ADMIN' : 'USER' }
        })
      )
    }, next)
  })

  return router
}
