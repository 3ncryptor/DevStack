import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'
import { AUTH_OPENAPI_SLOTS } from './openapi'

const USER_MODELS_TEMPLATE = `enum Role {
  USER
  ADMIN
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String?
  passwordHash  String
  role          Role           @default(USER)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  refreshTokens RefreshToken[]
__TODOS__}

/// One row per issued refresh token, stored as a SHA-256 hash; rotated on every use (D-66).
model RefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}`

/** The User model gains its side of Todo.owner when the Todo template is selected (B17.8). */
const USER_MODELS = USER_MODELS_TEMPLATE.replace('__TODOS__', '')
const USER_MODELS_WITH_TODOS = USER_MODELS_TEMPLATE.replace('__TODOS__', '  todos         Todo[]\n')

/**
 * Email + password auth with JWTs (B17.5, D-66): a short-lived access token and a rotating
 * refresh token, both in httpOnly cookies; roles for the admin app (D-67). Express + Prisma for
 * now (M3); the core in src/<domains>/auth is framework- and ORM-agnostic (B17.6).
 */
const moduleDefinition: DevstackModule = {
  id: 'auth-jwt',
  title: 'Email + password (JWT)',
  category: 'auth',
  language: 'node',
  provides: ['auth'],
  description:
    'Register, login, refresh and logout with argon2 password hashing, JWT access tokens and rotating refresh tokens',
  // login and register always get a strict per-IP limit (brute force, argon2 cost)
  requires: ['framework-express', 'orm-prisma', 'core-backend', 'security-rate-limit'],
  dependencies: ['argon2', 'jose', 'cookie-parser'],
  scripts: [{ name: 'auth:make-admin', run: 'tsx src/scripts/make-admin.ts' }],
  env: [
    {
      name: 'JWT_SECRET',
      description:
        'Signs access tokens (HS256): 32 random bytes or more, e.g. openssl rand -base64 32. Generated for local use',
      required: true,
      secret: true,
      generate: 'secret',
      // 32 bytes of base64 is 43 characters: HS256 wants a 256-bit key
      schema: 'z.string().min(43)'
    },
    {
      name: 'JWT_ACCESS_TTL_MINUTES',
      description: 'Access token lifetime in minutes',
      example: '15',
      required: false,
      schema: 'z.coerce.number().int().positive().default(15)'
    },
    {
      name: 'REFRESH_TOKEN_TTL_DAYS',
      description: 'Refresh token lifetime in days; each use issues a new one',
      example: '7',
      required: false,
      schema: 'z.coerce.number().int().positive().default(7)'
    },
    {
      name: 'ALLOWED_ORIGINS',
      description: 'Comma-separated origins allowed to call the API, e.g. https://app.example.com',
      required: false,
      warnIfUnset:
        "ALLOWED_ORIGINS is empty: in production, cookie-authenticated requests are then accepted only from the API's own origin. Set it to your web app's origin before deploying a split-origin app."
    }
  ],
  slots: [
    { slot: 'prisma.models', code: USER_MODELS, when: { not: { has: 'template-todo' } } },
    { slot: 'prisma.models', code: USER_MODELS_WITH_TODOS, when: { has: 'template-todo' } },
    {
      slot: 'app.imports',
      code: [
        "import cookieParser from 'cookie-parser'",
        "import { createAuthRouter } from './__domains__/auth/auth.routes.js'",
        "import type { AuthService } from './__domains__/auth/auth.service.js'"
      ].join('\n')
    },
    // cookies are parsed after the security middleware, before any route
    { slot: 'app.middleware', code: 'app.use(cookieParser())', order: 90 },
    { slot: 'app.deps', code: 'auth: AuthService' },
    { slot: 'app.routes', code: "api.use('/auth', createAuthRouter(deps.auth))" },
    {
      slot: 'index.imports',
      code: [
        "import { authConfig } from './__domains__/auth/auth.config.js'",
        "import { createAuthService } from './__domains__/auth/auth.service.js'",
        "import { prismaAuthRepositories } from './db/repositories/auth.repository.prisma.js'"
      ].join('\n')
    },
    {
      slot: 'index.deps',
      code: 'auth: createAuthService({ ...prismaAuthRepositories, config: authConfig(env) }),'
    },
    { slot: 'test.imports', code: "import { testAuthService } from './auth.js'" },
    { slot: 'test.deps', code: 'auth: testAuthService(),' },
    ...AUTH_OPENAPI_SLOTS
  ],
  filesPath: moduleFilesPath('auth-jwt')
}

export default moduleDefinition
