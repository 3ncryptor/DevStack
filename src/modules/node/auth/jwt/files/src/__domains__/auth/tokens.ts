import { createHash, randomBytes } from 'node:crypto'

import { errors, jwtVerify, SignJWT } from 'jose'

import { ROLES, type Role } from './auth.repository.js'

const ALGORITHM = 'HS256'
/** 256 bits, the HS256 key size; a shorter secret is guessable offline from any token. */
const MIN_SECRET_LENGTH = 32
const REFRESH_TOKEN_BYTES = 32

/** What an access token proves: who the caller is and their role when it was issued. */
export interface AccessClaims {
  userId: string
  role: Role
}

export interface SignedToken {
  token: string
  expiresAt: Date
}

/** Issues and checks access tokens: stateless JWTs here, server-side sessions with auth-session. */
export interface AccessTokens {
  sign(claims: AccessClaims, now: Date): Promise<SignedToken>
  /** null for an invalid, expired, revoked or tampered token. */
  verify(token: string): Promise<AccessClaims | null>
  /** Ends one access token now, where the store allows it (a JWT simply expires). */
  revoke(token: string): Promise<void>
  /** Ends every access token of a user now, where the store allows it. */
  revokeAllForUser(userId: string): Promise<void>
}

const isRole = (value: unknown): value is Role => ROLES.includes(value as Role)

/** Short-lived HS256 JWTs (D-66); only HS256 is accepted when verifying. */
export function createAccessTokens(secret: string, ttlMinutes: number): AccessTokens {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`The JWT secret must be at least ${MIN_SECRET_LENGTH} characters`)
  }
  const key = new TextEncoder().encode(secret)
  return {
    async sign(claims, now) {
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000)
      const token = await new SignJWT({ role: claims.role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(claims.userId)
        .setIssuedAt(Math.floor(now.getTime() / 1000))
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(key)
      return { token, expiresAt }
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] })
        if (typeof payload.sub !== 'string' || !isRole(payload.role)) return null
        return { userId: payload.sub, role: payload.role }
      } catch (error: unknown) {
        // a bad token is the caller's problem; anything else is a bug worth a 500
        if (error instanceof errors.JOSEError) return null
        throw error
      }
    },
    // stateless: a JWT stays valid until it expires, which is why its lifetime is short
    revoke: () => Promise.resolve(),
    revokeAllForUser: () => Promise.resolve()
  }
}

/** An opaque refresh token; only its hash is stored. */
export const newRefreshToken = (): string => randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
