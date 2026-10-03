---
'create-devstack-app': patch
---

Fixes found by the bug hunt: `add` and `remove` run `prisma generate` again, so adding auth or
the Todo template to a Prisma project builds; the sliding-window rate limiter's Retry-After no
longer sends clients back too early, and the token and leaky buckets allow a request at exactly
the time they named; Prisma on SQLite approves better-sqlite3's build with pnpm; Better Auth tests
on Fastify and NestJS await the app again; Docker database health checks allow for a slow first
start.
