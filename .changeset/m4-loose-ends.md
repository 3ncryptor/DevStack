---
'create-devstack-app': patch
---

- With pino, `dev` pipes logs through `pino-pretty`; `start`, tests and production stay JSON.
- Sessions in Redis no longer ask for an unused `JWT_SECRET`; a JWT signer refuses a short secret.
- Docker images install the exact pnpm or bun version that wrote the lockfile, so a frozen install
  in the image accepts what the developer's install accepted.
