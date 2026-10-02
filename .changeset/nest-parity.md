---
'create-devstack-app': minor
---

NestJS catches up with Express and Fastify:

- Authentication on Nest: _Email + password (JWT)_ and _Better Auth_ (with GitHub and Google),
  as a Nest `AuthModule` with `AuthGuard`, `RolesGuard` and `@Roles('ADMIN')`, the same cookies,
  CSRF checks, rate limits and generated tests.
- API docs on Nest: the Scalar reference at `/docs` and `/openapi.json`, including the auth routes.
- Fix: with `/v1`, unknown paths on Nest now answer the JSON error envelope instead of an HTML 404
  (Nest now uses URI versioning).
- The wizard offers API docs for Fastify and Nest too.
