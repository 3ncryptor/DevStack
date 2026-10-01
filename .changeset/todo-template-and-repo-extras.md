---
'create-devstack-app': minor
---

Finishes M2 and M3 (tasks 3.8, 3.11, 3.12):

- **App template: Todo app** (wizard question 10). Todos from the Prisma model to a `/todos` page
  in the web app: filters, cursor pagination, create, edit, toggle and delete. With auth each
  user sees only their own todos (another user's todo answers 404). `db:seed` adds sample todos
  and, with auth, a demo user. Generated tests include an ownership test.
- **Repo extras** (wizard question 18, all on by default): `AGENTS.md` written from your stack
  with `CLAUDE.md` importing it, VS Code settings, extensions and a debug launch, and GitHub
  hygiene files (Dependabot, PR and issue templates, CODEOWNERS).
- **Architectures:** "Flat" is now a module recorded in `.devstack/stack.json`, and both
  architecture questions preview each folder layout.
