---
'create-devstack-app': minor
---

Generated backends follow the golden path (Phase 1, task 1.10), for Express and NestJS.

- `createApp(deps)` builds the app without listening; the entry point validates the environment
  with Zod (every problem listed at once), creates a pino logger and handles shutdown.
- Every request gets an id (`x-request-id`) and every error the same envelope:
  `{ error: { code, message, requestId, details? } }`, never a stack trace.
- `GET /health` for liveness and `GET /ready` for dependencies: with Prisma, `/ready` runs
  `SELECT 1` and answers 503 while the database is down; shutdown closes the pool.
- Projects ship a passing Supertest test (`node:test`), a README for the chosen stack, and a local
  `.env` with working defaults that is never overwritten.
- Prisma scripts are now `db:generate`, `db:migrate`, `db:reset` and `db:studio`, plus `db:up` and
  `db:down` when Docker is selected. The starter `User` model is gone: add your own models.
- Express projects start from `src/index.ts` (`dist/index.js`) instead of `src/server.ts`.
