import { createHash, randomBytes } from 'node:crypto'

import { errors, jwtVerify, SignJWT } from 'jose'

import { ROLES, type Role } from './auth.repository.js'

const ALGORITHM = 'HS256'
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

export interface AccessTokens {
  sign(claims: AccessClaims, now: Date): Promise<SignedToken>
  /** null for an invalid, expired or tampered token. */
  verify(token: string): Promise<AccessClaims | null>
}

const isRole = (value: unknown): value is Role => ROLES.includes(value as Role)

/** Short-lived HS256 JWTs (D-66); only HS256 is accepted when verifying. */
export function createAccessTokens(secret: string, ttlMinutes: number): AccessTokens {
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
    }
  }
}

/** An opaque refresh token; only its hash is stored. */
export const newRefreshToken = (): string => randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
