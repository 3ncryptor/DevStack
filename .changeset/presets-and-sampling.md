---
'create-devstack-app': minor
---

Presets (M4): `backend-fastify`, `backend-nest`, `api-mongo` and `fullstack-vite-express`, each
tested end to end. With Docker in a monorepo, the API container now reads `apps/api/.env`, so auth
secrets reach it. Better Auth without OAuth providers no longer fails lint.
