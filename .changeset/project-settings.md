---
'create-devstack-app': minor
---

Project settings (M5): a stack config can now carry `settings` for the code style (semicolons,
quotes, trailing commas, print width, tabs), TypeScript strictness (`standard` or `strictest`), app
folder names and ports in a monorepo, license, author, description and whether to make the initial
commit. Every generated file follows them, and the project records them in `.devstack/stack.json`.
Projects also get an `.editorconfig`.
