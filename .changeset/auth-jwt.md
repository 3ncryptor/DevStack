---
'create-devstack-app': minor
---

Email + password auth for Express + Prisma (M3, task 4.1):

- New wizard question **Authentication**: _Email + password (JWT)_. It generates register, login,
  refresh, logout and `GET /auth/me` routes, a `User` and `RefreshToken` model, argon2id password
  hashing, and `requireAuth` / `requireRole('ADMIN')` for your own routes.
- Sessions use a 15-minute access token and a 7-day refresh token in httpOnly cookies. The
  refresh token rotates on every use, and a reused one ends every session of its user.
  Cookie-authenticated writes must come from `ALLOWED_ORIGINS` (CSRF).
- Login and register get a stricter rate limit when rate limiting is selected. The auth routes
  appear in the OpenAPI document when API docs are selected.
- `JWT_SECRET` gets a random value in your local `.env` (never in `.env.example`); the summary
  reminds you to set your own in production. `auth:make-admin <email>` promotes a user.
- Generated tests run on in-memory repositories, plus one against Postgres once it is migrated.
- Generated API tests now share a `tests/helpers/app.ts` with `testApp()`.
