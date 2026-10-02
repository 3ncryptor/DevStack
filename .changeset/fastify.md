---
'create-devstack-app': minor
---

Fastify 5 as a backend framework (M4): the same baseline as Express (validated env, pino logs with
request ids, the error envelope, `/health` and `/ready`, graceful shutdown, Zod validation, tests
with `app.inject()`), and CORS, Helmet, rate limiting, origin checks, request logging,
compression, `/v1` and Scalar docs as Fastify plugins. Modules can now declare dependencies that
apply only to some stacks, so a Fastify project installs `@fastify/cors` and not `cors`.
