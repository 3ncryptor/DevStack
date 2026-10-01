---
'create-devstack-app': minor
---

Fullstack projects (Phase 3, task 3.9, Next.js part): the wizard offers **Fullstack**, which puts
the API in `apps/api` and a Next.js 16 web app in `apps/web`.

- The home page shows "API ✓ connected · DB ✓ connected" from the API's `/ready`; `/health`
  answers for the web app too.
- In development `/api/*` is proxied to the API, so there is no CORS to configure; the API's
  CORS allowlist is set to the web origin.
- `packages/shared` holds the response envelope types and a typed `apiClient` that turns error
  responses into `ApiClientError`.
- Tailwind CSS 4 or plain CSS; ports 3000 (web) and 3001 (api).
- NestJS projects now always get `@types/express`; without rate limiting or origin checks they
  failed to type-check.
