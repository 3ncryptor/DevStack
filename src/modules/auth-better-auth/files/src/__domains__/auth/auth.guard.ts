import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'

import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js'
import type { Auth } from './auth.js'
import { requireAuth, type Role } from './require-auth.js'

/** The injection token of the Better Auth instance (provided by AuthModule.register). */
export const AUTH = Symbol('Auth')

const ROLE_KEY = 'auth:role'

/** With RolesGuard: only users with this role, e.g. `@Roles('ADMIN')` (D-67). */
export const Roles = (role: Role) => SetMetadata(ROLE_KEY, role)

/**
 * A valid session or 401, and `request.user` set: `@UseGuards(AuthGuard)`. It runs the same
 * requireAuth as the Express adapter (origin check on writes, then the session), as a guard.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp()
    return new Promise((resolve, reject) => {
      requireAuth(this.auth)(
        http.getRequest<Request>(),
        http.getResponse<Response>(),
        (error?: unknown) => {
          if (error === undefined) resolve(true)
          else reject(error instanceof Error ? error : new UnauthorizedError())
        }
      )
    })
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
