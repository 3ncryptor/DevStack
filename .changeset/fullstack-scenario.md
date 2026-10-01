---
'create-devstack-app': minor
---

Everything the fullstack wizard asks is now built and wired (D-64):

- **Admin frontend**: an optional second Next.js app in `apps/admin` (port 3002) that shares the
  API, `packages/shared`, the styling and the folder structure of `apps/web`.
- **Frontend architecture**: feature-based, layer-based or atomic design folders in every web app.
- **Backend architecture**: feature-scoped (new default), clean, MVC (now with `utils/`,
  `validators/` and `config/`) or flat.
- **Rate limiting**: fixed window, sliding window, token bucket or leaky bucket, generated with
  its own tests; 429 answers use the standard error envelope and `RateLimit-*`/`Retry-After`
  headers. `express-rate-limit` is no longer a dependency.
- **API versioning**: optional `/v1` prefix for application routes (Express router, Nest global
  prefix); `/health` and `/ready` stay unversioned; `GET /v1` describes the API.
- **Error handling**: unhandled promise rejections and uncaught exceptions are logged and shut the
  server down cleanly (exit 1).
- Fixes: a request from an origin outside the CORS allowlist no longer fails with a 500 (it simply
  gets no CORS headers); Next.js's generated `next-env.d.ts` no longer fails the project's format
  check after a build.
