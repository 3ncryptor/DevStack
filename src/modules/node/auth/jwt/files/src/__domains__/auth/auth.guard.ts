import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ForbiddenError, TooManyRequestsError, UnauthorizedError } from '../../lib/errors.js'
import { createLimiter } from '../../lib/rate-limiter.js'
import { ACCESS_COOKIE, readCookie } from './auth.cookies.js'
import type { Role } from './auth.repository.js'
import type { AuthService } from './auth.service.js'
import { assertTrustedOrigin } from './require-auth.js'

/** The injection token of the auth service (provided by AuthModule.register). */
export const AUTH_SERVICE = Symbol('AuthService')

const ROLE_KEY = 'auth:role'

/** With RolesGuard: only users with this role, e.g. `@Roles('ADMIN')` (D-67). */
export const Roles = (role: Role) => SetMetadata(ROLE_KEY, role)

/**
 * A valid access token (Bearer header or cookie) or 401, and `request.user` set:
 * `@UseGuards(AuthGuard)`. Cookie-authenticated writes must come from a trusted origin (D-66).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const header = request.get('authorization')
    const bearer =
      header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length) : undefined
    const token = bearer ?? readCookie(request, ACCESS_COOKIE)
    if (token === undefined) throw new UnauthorizedError()
    // a Bearer header is never sent by the browser on its own, so only cookies need the check
    if (bearer === undefined) assertTrustedOrigin(request, this.auth.config)
    const claims = await this.auth.verifyAccessToken(token)
    if (claims === null) throw new UnauthorizedError('Access token is invalid or expired')
    request.user = claims
    return true
  }
}

/** After AuthGuard: enforces `@Roles(...)`; routes without it are open to every user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.getAllAndOverride<Role | undefined>(ROLE_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (role === undefined) return true
    const user = context.switchToHttp().getRequest<Request>().user
    if (user === undefined) throw new UnauthorizedError()
    if (user.role !== role) throw new ForbiddenError()
    return true
  }
}

// login and register are brute-force targets: far fewer attempts than the API-wide limit
const CREDENTIAL_ATTEMPTS = 10
const CREDENTIAL_WINDOW_MS = 15 * 60_000

/** A strict per-IP limit for the credential routes. */
@Injectable()
export class CredentialLimitGuard implements CanActivate {
  private readonly limiter = createLimiter(CREDENTIAL_ATTEMPTS, CREDENTIAL_WINDOW_MS)

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (!this.limiter.consume(request.ip ?? 'unknown').allowed) throw new TooManyRequestsError()
    return true
  }
}
