import type { Request, RequestHandler } from 'express'

import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js'
import type { AuthConfig } from './auth.config.js'
import { ACCESS_COOKIE, readCookie } from './auth.cookies.js'
import type { Role } from './auth.repository.js'
import type { AuthService } from './auth.service.js'
import type { AccessClaims } from './tokens.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function bearerToken(request: Request): string | undefined {
  const header = request.get('authorization')
  return header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length) : undefined
}

/**
 * CSRF defence for cookie auth (D-66): browsers send `Origin` on cross-origin writes, so a write
 * carrying cookies must come from ALLOWED_ORIGINS. Without an allowlist, development trusts any
 * origin (the web app's proxy) and production only the API's own origin (behind a TLS proxy,
 * set ALLOWED_ORIGINS: the API sees http). No `Origin` at all is a non-browser client, unless
 * the browser's own `Sec-Fetch-Site` says the request is cross-site.
 */
export function isTrustedOrigin(request: Request, config: AuthConfig): boolean {
  if (SAFE_METHODS.has(request.method)) return true
  const origin = request.get('origin')
  if (origin === undefined) return request.get('sec-fetch-site') !== 'cross-site'
  if (config.allowedOrigins.length > 0) return config.allowedOrigins.includes(origin)
  return !config.production || origin === `${request.protocol}://${request.get('host') ?? ''}`
}

/** Refuses a cookie-authenticated write from an untrusted origin with 403. */
export function assertTrustedOrigin(request: Request, config: AuthConfig): void {
  if (!isTrustedOrigin(request, config)) throw new ForbiddenError('Origin not allowed')
}

async function authenticate(request: Request, auth: AuthService): Promise<AccessClaims> {
  const bearer = bearerToken(request)
  const token = bearer ?? readCookie(request, ACCESS_COOKIE)
  if (token === undefined) throw new UnauthorizedError()
  // a Bearer header is never sent by the browser on its own, so only cookies need the check
  if (bearer === undefined) assertTrustedOrigin(request, auth.config)
  const claims = await auth.verifyAccessToken(token)
  if (claims === null) throw new UnauthorizedError('Access token is invalid or expired')
  return claims
}

/**
 * Lets a request through with a valid access token (Bearer header or cookie) and sets
 * `request.user`: `router.get('/todos', requireAuth(deps.auth), handler)`.
 */
export function requireAuth(auth: AuthService): RequestHandler {
  return (request, _response, next) => {
    authenticate(request, auth).then((claims) => {
      request.user = claims
      next()
    }, next)
  }
}

/**
 * After requireAuth: only users with this role, e.g. `requireRole('ADMIN')`. The role comes from
 * the access token, so a role change applies at the next refresh (at most the token lifetime).
 */
export function requireRole(role: Role): RequestHandler {
  return (request, _response, next) => {
    if (request.user === undefined) {
      next(new UnauthorizedError())
      return
    }
    next(request.user.role === role ? undefined : new ForbiddenError())
  }
}
