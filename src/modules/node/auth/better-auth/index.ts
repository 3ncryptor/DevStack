import { z } from 'zod'

import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule, SlotContribution } from '../../../../types/module'

const VERSIONED: Condition = { has: 'api-versioning' }
const FASTIFY: Condition = { has: 'framework-fastify' }
const NOT_FASTIFY: Condition = { not: FASTIFY }
const EXPRESS: Condition = { has: 'framework-express' }
const NEST: Condition = { has: 'framework-nest' }
const GITHUB: Condition = { option: 'github', equals: true }
const GOOGLE: Condition = { option: 'google', equals: true }

// Better Auth's tables (1.7) plus the admin plugin's fields, in Prisma (D-69); lowercase table
// names are what its Prisma adapter expects by default
const MODELS_TEMPLATE = `model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String?   @default("user")
  banned        Boolean?  @default(false)
  banReason     String?
  banExpires    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
__TODOS__
  @@map("user")
}

model Session {
  id             String   @id
  token          String   @unique
  expiresAt      DateTime
  ipAddress      String?
  userAgent      String?
  impersonatedBy String?
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}`

/** The User model gains its side of Todo.owner when the Todo template is selected (B17.8). */
const MODELS = MODELS_TEMPLATE.replace('__TODOS__', '')
const MODELS_WITH_TODOS = MODELS_TEMPLATE.replace('__TODOS__', '  todos         Todo[]\n')

/** Better Auth's handler, before express.json() (it reads the body itself), at {prefix}/auth. */
const mount = (prefix: string, when: Condition): SlotContribution => ({
  slot: 'app.middleware',
  code: `app.all('${prefix}/auth/*splat', toNodeHandler(deps.auth))`,
  order: 95,
  when: { all: [when, EXPRESS] }
})

/** Nest: on its Express instance, before Nest's body parser (added when the app initialises). */
const nestMount = (prefix: string, when: Condition): SlotContribution => ({
  slot: 'app.middleware',
  code: `app.getHttpAdapter().getInstance().all('${prefix}/auth/*splat', toNodeHandler(deps.auth))`,
  order: 95,
  when: { all: [when, NEST] }
})

const providerEnv = (provider: 'GITHUB' | 'GOOGLE', label: string, when: Condition) =>
  (['CLIENT_ID', 'CLIENT_SECRET'] as const).map((part) => ({
    name: `${provider}_${part}`,
    description: `${label} OAuth app ${part === 'CLIENT_ID' ? 'client id' : 'client secret'}`,
    required: false,
    secret: part === 'CLIENT_SECRET',
    when,
    ...(part === 'CLIENT_ID'
      ? {
          warnIfUnset: `${provider}_CLIENT_ID is empty: ${label} sign-in stays off until ${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET are set. Callback URL: <BETTER_AUTH_URL>/auth/callback/${provider.toLowerCase()} (/v1/auth with API versioning).`
        }
      : {})
  }))

/**
 * Better Auth (task 4.2, D-38, D-69): email + password and, when selected, GitHub and Google
 * sign-in, with database sessions in httpOnly cookies and the admin plugin's roles (D-67).
 * Express + Prisma for now (M3).
 */
const moduleDefinition: DevstackModule = {
  id: 'auth-better-auth',
  title: 'Better Auth',
  category: 'auth',
  language: 'node',
  wizard: {
    question: 'auth',
    order: 3,
    hint: 'email + password, optional GitHub and Google sign-in, database sessions'
  },
  agentsMd: {
    conventions: [
      "- Protect routes with `requireAuth(deps.auth)`, admin routes with `requireRole('ADMIN')` after it; the web app's `RequireAuth` is for the user experience only."
    ]
  },
  provides: ['auth'],
  description:
    'Better Auth: email + password, optional GitHub and Google sign-in, database sessions and admin roles',
  requiresAny: ['framework-express', 'framework-fastify', 'framework-nest'],
  // written and tested on Postgres; other databases are a later port (D-77)
  requires: ['orm-prisma', 'database-postgres', 'core-backend'],
  dependencies: ['better-auth'],
  options: z.object({
    github: z.boolean().default(false),
    google: z.boolean().default(false)
  }),
  scripts: [{ name: 'auth:make-admin', run: 'tsx src/scripts/make-admin.ts' }],
  env: [
    {
      name: 'BETTER_AUTH_SECRET',
      description:
        'Signs session cookies: 32 random bytes or more, e.g. openssl rand -base64 32. Generated for local use',
      required: true,
      secret: true,
      generate: 'secret',
      schema: 'z.string().min(43)'
    },
    {
      name: 'BETTER_AUTH_URL',
      description:
        "The API's public URL, for OAuth callbacks, e.g. https://api.example.com; unset uses http://localhost:<PORT>",
      required: false,
      schema: 'z.url().optional()',
      warnIfUnset:
        "BETTER_AUTH_URL is empty: OAuth callbacks go to http://localhost:<PORT>. Set it to the API's public URL before deploying."
    },
    {
      name: 'ALLOWED_ORIGINS',
      description: 'Comma-separated origins allowed to call the API, e.g. https://app.example.com',
      required: false,
      warnIfUnset:
        "ALLOWED_ORIGINS is empty: Better Auth then trusts only the API's own origin, so a web app on another origin cannot sign in. Set it to your web app's origin."
    },
    ...providerEnv('GITHUB', 'GitHub', GITHUB),
    ...providerEnv('GOOGLE', 'Google', GOOGLE)
  ],
  slots: [
    { slot: 'prisma.models', code: MODELS, when: { not: { has: 'template-todo' } } },
    { slot: 'prisma.models', code: MODELS_WITH_TODOS, when: { has: 'template-todo' } },
    {
      slot: 'app.imports',
      code: "import { toNodeHandler } from 'better-auth/node'",
      when: NOT_FASTIFY
    },
    {
      slot: 'app.imports',
      code: "import { createAuthRouter } from './__domains__/auth/auth.routes.js'",
      when: EXPRESS
    },
    {
      slot: 'app.imports',
      code: [
        "import { registerBetterAuth } from './__domains__/auth/auth.handler.js'",
        "import { createAuthRoutes } from './__domains__/auth/auth.routes.js'"
      ].join('\n'),
      when: FASTIFY
    },
    { slot: 'app.imports', code: "import type { Auth } from './__domains__/auth/auth.js'" },
    // Fastify parses the body itself and hands it on; the route sits at AUTH_BASE_PATH
    { slot: 'app.plugins', code: 'registerBetterAuth(app, deps.auth)', order: 95, when: FASTIFY },
    mount('/v1', VERSIONED),
    mount('', { not: VERSIONED }),
    nestMount('/v1', VERSIONED),
    nestMount('', { not: VERSIONED }),
    { slot: 'app.deps', code: 'auth: Auth' },
    // GET /me through requireAuth: the session as the rest of the API sees it
    { slot: 'app.routes', code: 'api.use(createAuthRouter(deps.auth))', when: EXPRESS },
    // Nest: GET /me and the guards come with the auth module (D-74)
    {
      slot: 'appModule.imports',
      code: "import { AuthModule } from './__domains__/auth/auth.module.js'",
      when: NEST
    },
    { slot: 'appModule.modules', code: 'AuthModule.register(deps.auth),', when: NEST },
    { slot: 'app.routes', code: 'void api.register(createAuthRoutes(deps.auth))', when: FASTIFY },
    {
      slot: 'index.imports',
      code: [
        "import { prismaAdapter } from 'better-auth/adapters/prisma'",
        "import { authSettings, createAuth } from './__domains__/auth/auth.js'",
        "import { prisma } from './db/client.js'"
      ].join('\n')
    },
    {
      slot: 'index.deps',
      code: "auth: createAuth(prismaAdapter(prisma, { provider: 'postgresql' }), authSettings(env)),"
    },
    { slot: 'test.imports', code: "import { testAuth } from './auth.js'" },
    { slot: 'test.deps', code: 'auth: testAuth().auth,' }
  ],
  files: [
    { path: 'src/__domains__/auth/auth.handler.ts', when: FASTIFY },
    { path: 'src/__domains__/auth/auth.routes.ts', when: { not: NEST } },
    { path: 'src/__domains__/auth/auth.guard.ts', when: NEST },
    { path: 'src/__domains__/auth/me.controller.ts', when: NEST },
    { path: 'src/__domains__/auth/auth.module.ts', when: NEST }
  ],
  filesPath: moduleFilesPath('node/auth/better-auth')
}

export default moduleDefinition
