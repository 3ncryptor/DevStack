/**
 * The auth domain's data access, as interfaces (B17.6): the ORM adapter in src/db/repositories
 * implements them, tests use in-memory ones. Nothing here knows about HTTP or the database.
 */

export const ROLES = ['USER', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

/** A user as the rest of the app sees it: never with the password hash. */
export interface User {
  id: string
  email: string
  name: string | null
  role: Role
  createdAt: Date
}

export interface UserRecord extends User {
  passwordHash: string
}

export interface NewUser {
  email: string
  name: string | null
  passwordHash: string
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>
  findById(id: string): Promise<UserRecord | null>
  /** Throws ConflictError when the email is already registered. */
  create(user: NewUser): Promise<UserRecord>
  /** null when no user has this email. */
  setRole(email: string, role: Role): Promise<UserRecord | null>
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  expiresAt: Date
  revokedAt: Date | null
}

export interface RefreshTokenRepository {
  create(token: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>
  /**
   * Revokes the token only if it is still active, atomically: false means another request
   * already used it, which is treated as reuse.
   */
  revoke(id: string, now: Date): Promise<boolean>
  revokeAllForUser(userId: string, now: Date): Promise<void>
}

export interface AuthRepositories {
  users: UserRepository
  refreshTokens: RefreshTokenRepository
}

export function toUser(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    createdAt: record.createdAt
  }
}
