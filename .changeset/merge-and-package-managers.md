---
'create-devstack-app': minor
---

Generating into an existing project adds to its files instead of replacing them (Phase 1,
task 1.3), and all four package managers are verified end to end.

- An existing `package.json` gets the missing scripts, dependencies and settings; your values
  win, and the summary lists any generated value that differed. `.gitignore` and `.dockerignore`
  get only the missing lines. Originals are backed up; a second run changes nothing. A
  `package.json` that is not valid JSON is treated as a conflict, as before.
- yarn and bun now pass the same end-to-end checks as npm and pnpm.
- The pre-flight warns when your Node.js is older than the generated project needs (24), and stops
  a yarn install, which would refuse, before anything is written.
