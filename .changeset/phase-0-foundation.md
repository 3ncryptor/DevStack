---
'create-devstack-app': minor
---

First release under the `create-devstack-app` name (Phase 0 of the build plan).

- Generated projects pass their own lint, format, typecheck and build, boot with `/health`, and
  shut down cleanly on SIGTERM, on npm and pnpm (Express 5 or NestJS 12, ESM, Node 24).
- Middleware is imported explicitly through template slots; the runtime `require()` that could
  silently drop security middleware is gone.
- `--dry-run` and `--print-plan [text|json]`; `--yes` never overwrites, `--force` backs up
  originals first; nothing is ever deleted.
- `--config stack.json` and a `.devstack/stack.json` manifest in every project.
- Prisma 7 with the pg driver adapter, a version catalog, pnpm build approvals, a production
  Dockerfile, `.env.example` from module env declarations, and a post-generation summary.
- Strict project-name validation and path containment (symlinks and paths outside the project
  are refused).
