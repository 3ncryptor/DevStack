---
'create-devstack-app': minor
---

Guided wizard, review screen and environment checks (Phase 1, tasks 1.2 and 1.8).

- The wizard asks the build plan's questions in order and skips the ones that do not apply:
  framework, database and ORM, package manager (missing ones are marked), architecture,
  pre-commit hooks, Docker, and what `app.ts` sets up. ESLint, Prettier and TypeScript are always
  included.
- A review screen comes before anything is written: Generate, Edit an answer, Save as preset (a
  stack file for `--config`, never overwriting an existing file) or Cancel. With `--advanced`,
  stacks that do not fit together show the resolver's fixes as choices.
- `--preset` without `--yes` now opens the review screen instead of generating straight away.
- `init` checks Node.js, package managers and git identity before the first question, and fails
  before writing anything if the chosen package manager is not installed. Docker is checked when
  the stack uses it.
- New commands: `doctor`, `plan` (resolve and print, write nothing) and `modules list`
  (`--category`, `--json`).
