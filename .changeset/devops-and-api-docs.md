---
'create-devstack-app': minor
---

CI, containers and API docs (Phase 3 task 3.7, Phase 4 task 4.4 for Express):

- **GitHub Actions**: a CI workflow that installs with your package manager and runs lint,
  format, typecheck, build and test, with a read-only token.
- **Docker for monorepos**: one image per app, built from a pruned workspace (the web and admin
  apps use Next.js standalone output), and a compose file that runs the whole stack —
  database, API, web and admin — each starting once the one it needs is healthy.
- **API docs**: an OpenAPI document at `/openapi.json` and a Scalar reference at `/docs` for
  Express APIs; off in production unless `API_DOCS=true`.
- The wizard asks about API docs and CI, and offers Docker for fullstack projects again.
- Fullstack projects no longer warn that `ALLOWED_ORIGINS` is empty: it is set to the web apps.
