# create-devstack-app

## 1.0.0

### Major Changes

- First public release. One command scaffolds a TypeScript project from the stack you choose and
  hands it back running: wired together, lint, format, typecheck, test and build all passing, and
  booted once before you see it.

  - **Backends:** Express 5, Fastify 5 or NestJS, ESM or CommonJS, built around `createApp(deps)`:
    validated environment, request-id logs (pino, Winston or JSON), one response envelope,
    `/health` and `/ready`, graceful shutdown, and a test that passes on day one.
  - **Fullstack monorepos** on npm, pnpm, yarn or bun workspaces with Turborepo: Next.js 16 or
    React + Vite, Tailwind or CSS Modules, an optional admin app, the web app talking to the API
    through a dev proxy.
  - **Data:** PostgreSQL, MySQL, SQLite or MongoDB with Prisma, Drizzle or Mongoose, wired into
    `/ready` and shutdown, plus Redis caching.
  - **Auth:** JWT (argon2id, rotating refresh tokens in httpOnly cookies), Better Auth with GitHub
    and Google sign-in, or sessions; login pages in the web apps.
  - **Around the code:** security middleware, rate limiting, API versioning, Scalar API docs,
    Vitest or Jest, ESLint + Prettier + Husky, Docker and a whole-stack compose file, GitHub
    Actions, `AGENTS.md`/`CLAUDE.md`, VS Code settings, and an optional Todo app to start from.
  - **After the first run:** `add` and `remove` modules in an existing project, `doctor` for the
    machine and dependency drift, remembered defaults and saved presets, `--config stack.json`,
    `plan`/`--dry-run`, and `mcp`, which serves DevStack to AI assistants over stdio.

  55 modules, each a folder plus one registry line; the module contract is frozen for 1.x.
