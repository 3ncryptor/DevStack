---
'create-devstack-app': minor
---

Tests and pre-commit (Phase 3, tasks 3.5 and 3.6):

- The wizard asks for the test runner: **Vitest** (default) or Node's built-in runner. With Vitest,
  the API tests run through it (NestJS compiles through SWC so dependency injection works), and
  fullstack projects also test the web apps.
- Pre-commit hooks scan every staged file with **secretlint** before lint and format, so keys and
  tokens are not committed by accident.
