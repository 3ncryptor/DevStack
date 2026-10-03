---
'create-devstack-app': minor
---

CommonJS backends: the wizard asks for the module system when there is a backend framework, and
`--module-system cjs` (or `"moduleSystem": "cjs"` in a config's settings) makes the API package
CommonJS. The TypeScript source is the same either way; Nest, Jest and Prisma are set up for the
chosen system, and web apps and the shared package stay ESM. Generated entry points, scripts and
tests no longer use top-level await.
