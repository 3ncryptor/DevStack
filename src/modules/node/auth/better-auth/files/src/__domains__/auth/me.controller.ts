import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { fromNodeHeaders } from 'better-auth/node'

import { UnauthorizedError } from '../../lib/errors.js'
import type { Auth } from './auth.js'
import { AUTH, AuthGuard } from './auth.guard.js'

/**
 * GET /me: the current user in the API's own envelope. Sign-up, sign-in, sign-out and OAuth are
 * Better Auth's own routes under /auth, mounted in app.ts.
 */
@Controller()
export class MeController {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() request: Request) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
    if (session === null) throw new UnauthorizedError()
    const { id, email, name, role } = session.user
    return { user: { id, email, name, role: role === 'admin' ? 'ADMIN' : 'USER' } }
  }
}
