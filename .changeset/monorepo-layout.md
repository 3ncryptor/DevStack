---
'create-devstack-app': minor
---

Monorepo layout (Phase 2, tasks 2.1–2.3): `layout-monorepo` puts the API in `apps/api` and the
tooling at the root, with workspaces for npm, pnpm, yarn and bun and Turborepo for `dev`, `build`,
`typecheck` and `test`. Lint, format and git hooks run once for the whole repo. Each app has its
own `package.json` and `.env`; the API listens on 3001, leaving 3000 for a web app. Single-folder
projects are unchanged.
