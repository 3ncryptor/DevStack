import { randomBytes } from 'node:crypto'

import { hashToken, type AccessClaims, type AccessTokens } from './tokens.js'

const SESSION_ID_BYTES = 32

/**
 * Where sessions live, keyed by the hash of their id (the id itself is never stored): Redis in
 * the app (src/cache/session-store.redis.ts), a Map in tests.
 */
export interface SessionStore {
  save(idHash: string, claims: AccessClaims, ttlSeconds: number): Promise<void>
  /** null when the session expired, was revoked or never existed. */
  find(idHash: string): Promise<AccessClaims | null>
  remove(idHash: string): Promise<void>
  removeAllForUser(userId: string): Promise<void>
}

/** Access tokens as opaque session ids (D-78): valid while the store holds them. */
export function createSessionTokens(store: SessionStore, ttlMinutes: number): AccessTokens {
  return {
    async sign(claims, now) {
      const token = randomBytes(SESSION_ID_BYTES).toString('base64url')
      await store.save(hashToken(token), claims, ttlMinutes * 60)
      return { token, expiresAt: new Date(now.getTime() + ttlMinutes * 60_000) }
    },
    verify: (token) => store.find(hashToken(token)),
    revoke: (token) => store.remove(hashToken(token)),
    revokeAllForUser: (userId) => store.removeAllForUser(userId)
  }
}
