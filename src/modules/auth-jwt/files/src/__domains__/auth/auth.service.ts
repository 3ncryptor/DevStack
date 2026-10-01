import { UnauthorizedError } from '../../lib/errors.js'
import type { AuthConfig } from './auth.config.js'
import { toUser, type AuthRepositories, type User, type UserRecord } from './auth.repository.js'
import { hashPassword, prepareTimingHash, verifyNothing, verifyPassword } from './password.js'
import {
  createAccessTokens,
  hashToken,
  newRefreshToken,
  type AccessClaims,
  type SignedToken
} from './tokens.js'

const DAY_MS = 24 * 60 * 60_000

/** A logged-in session: the user, a short-lived access token and the refresh token. */
export interface Session {
  user: User
  accessToken: SignedToken
  refreshToken: SignedToken
}

export interface RegisterInput {
  email: string
  password: string
  name?: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthService {
  readonly config: AuthConfig
  register(input: RegisterInput): Promise<Session>
  login(input: LoginInput): Promise<Session>
  /** Rotates the refresh token; a token used twice revokes every session of its user. */
  refresh(refreshToken: string): Promise<Session>
  logout(refreshToken: string | undefined): Promise<void>
  verifyAccessToken(token: string): Promise<AccessClaims | null>
  currentUser(userId: string): Promise<User>
}

export interface AuthServiceDeps extends AuthRepositories {
  config: AuthConfig
  /** Injected in tests to move time forward. */
  now?: () => Date
}

const INVALID_CREDENTIALS = 'Email or password is incorrect'
const SESSION_ENDED = 'Your session has ended; log in again'

/** Register, login, refresh and logout (B17.5, D-66), framework- and ORM-agnostic (B17.6). */
export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { users, refreshTokens, config } = deps
  const now = deps.now ?? (() => new Date())
  const accessTokens = createAccessTokens(config.jwtSecret, config.accessTokenTtlMinutes)
  prepareTimingHash()

  async function startSession(record: UserRecord): Promise<Session> {
    const issuedAt = now()
    const accessToken = await accessTokens.sign({ userId: record.id, role: record.role }, issuedAt)
    const token = newRefreshToken()
    const expiresAt = new Date(issuedAt.getTime() + config.refreshTokenTtlDays * DAY_MS)
    await refreshTokens.create({ userId: record.id, tokenHash: hashToken(token), expiresAt })
    return { user: toUser(record), accessToken, refreshToken: { token, expiresAt } }
  }

  return {
    config,

    async register(input) {
      const record = await users.create({
        email: input.email,
        name: input.name ?? null,
        passwordHash: await hashPassword(input.password)
      })
      return startSession(record)
    },

    async login(input) {
      const record = await users.findByEmail(input.email)
      const valid =
        record === null
          ? await verifyNothing(input.password)
          : await verifyPassword(record.passwordHash, input.password)
      if (record === null || !valid) throw new UnauthorizedError(INVALID_CREDENTIALS)
      return startSession(record)
    },

    async refresh(refreshToken) {
      const stored = await refreshTokens.findByHash(hashToken(refreshToken))
      if (stored === null) throw new UnauthorizedError(SESSION_ENDED)
      const at = now()
      // looked up first, so a failed lookup does not cost the user their session
      const record = await users.findById(stored.userId)
      if (record === null) throw new UnauthorizedError(SESSION_ENDED)
      // a revoked token presented again was stolen or replayed: end every session of the user
      if (stored.revokedAt !== null || !(await refreshTokens.revoke(stored.id, at))) {
        await refreshTokens.revokeAllForUser(stored.userId, at)
        throw new UnauthorizedError(SESSION_ENDED)
      }
      if (stored.expiresAt <= at) throw new UnauthorizedError(SESSION_ENDED)
      return startSession(record)
    },

    async logout(refreshToken) {
      if (refreshToken === undefined) return
      const stored = await refreshTokens.findByHash(hashToken(refreshToken))
      if (stored !== null && stored.revokedAt === null) await refreshTokens.revoke(stored.id, now())
    },

    verifyAccessToken: (token) => accessTokens.verify(token),

    async currentUser(userId) {
      const record = await users.findById(userId)
      if (record === null) throw new UnauthorizedError(SESSION_ENDED)
      return toUser(record)
    }
  }
}
