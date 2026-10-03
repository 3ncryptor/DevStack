---
'create-devstack-app': minor
---

`add` and `remove` (M5): change a generated project's stack later, e.g.
`npx create-devstack-app add security-rate-limit` or `remove cache-redis`, run in the project.
Files you have not touched are updated or deleted; files you edited are never overwritten (the new
version is written next to them as `.devstack-new`, or `--force` overwrites with a backup).
`package.json`, `.env` and `pnpm-workspace.yaml` are merged, then dependencies are installed.
`--dry-run` lists the changes first.
