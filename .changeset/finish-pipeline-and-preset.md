---
'create-devstack-app': minor
---

Finish pipeline and the fullstack preset (Phase 2 tasks 2.5–2.7, Phase 3 task 3.10 slice):

- After install, the project is checked with its own lint, format, typecheck, tests and build,
  then each app is booted and shut down: the summary says **Verified ✓**. A failure exits 1 with
  the failing step and its output. `--skip-verify` skips this.
- An initial commit on `main` (`chore: initial project setup (devstack)`), with your hooks, only
  in a repository DevStack created and only once `.env` files are ignored.
- **Connect a GitHub repository**: pass `--github <url>` or answer the wizard. The repository must
  exist and be empty; DevStack asks before pushing, never forces, and uses your own git
  credentials.
- **Start it now?** after a verified run, or `--start`: starts the database and the dev servers and
  opens the app.
- New preset **`fullstack-next-express`**: the recommended fullstack stack in one choice.
