# create-devstack-app

**One command from an empty folder to a running, wired TypeScript stack, with its checks passing.**

[![CI](https://github.com/3ncryptor/DevStack/actions/workflows/ci.yml/badge.svg)](https://github.com/3ncryptor/DevStack/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/create-devstack-app.svg)](https://www.npmjs.com/package/create-devstack-app)
[![Release](https://img.shields.io/github/v/release/3ncryptor/DevStack.svg)](https://github.com/3ncryptor/DevStack/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/3ncryptor/DevStack/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/website-devstack--app-4ade80.svg)](https://devstack-app-delta.vercel.app)

You pick the stack: an API on Express, Fastify or NestJS, optionally a Next.js or React web app
in a monorepo, a database and ORM, auth, tests, Docker, CI. DevStack writes the project with the
pieces already connected to each other, installs it, and runs its lint, format, typecheck, test
and build, then boots it and checks `/health`. You get the project after it has passed.

```text
$ npx create-devstack-app my-app --preset fullstack-next-express

my-app/                           93 files
├─ apps/api/                      Express 5 · Prisma 7 + PostgreSQL 18 · Vitest · OpenAPI + Scalar
│  └─ src/                        app.ts, config/env.ts, lib/{logger,errors,readiness,shutdown}.ts …
├─ apps/web/                      Next.js 16 · Tailwind 4 · "API ✓ connected · DB ✓ connected"
├─ packages/shared/               the response envelope types and a typed API client
├─ docker-compose.yml             the whole stack, PostgreSQL included
├─ .github/workflows/ci.yml       every check, on your package manager
├─ AGENTS.md · CLAUDE.md          your stack, explained to AI coding assistants
└─ .devstack/stack.json           the record you can regenerate the project from

✓ lint  ✓ format  ✓ typecheck  ✓ test  ✓ build  ✓ boot + /health
```

**Build a stack in the browser:** [devstack-app-delta.vercel.app](https://devstack-app-delta.vercel.app)
asks the wizard's questions and gives you the command for macOS, Linux or Windows.

## Quick start

```bash
npx create-devstack-app my-app
```

`npm create devstack-app`, `pnpm create devstack-app`, `yarn create devstack-app` and
`bun create devstack-app` do the same.

The wizard checks your machine (Node.js, package managers, git identity), then asks only the
questions that apply to your answers so far. Nothing is written until the review screen. When it
finishes, the CLI prints the next commands for your package manager, the environment variables
to fill in, and any warnings (for example, CORS left open to every origin).

Requires Node.js 22.12 or newer. Generated projects target Node.js 24, on npm, pnpm, yarn or bun.

## Features

- **An API that is production-shaped from the first commit.** Express 5, Fastify 5 or NestJS 12,
  ESM or CommonJS, built around `createApp(deps)` so tests need no open port:
  - environment validated with Zod at startup, every missing or invalid variable listed at once;
  - JSON logs with a request id per request (pino, Winston, or plain JSON lines);
  - one response envelope, `{ success: true, data, meta? }` and
    `{ success: false, error: { code, message, requestId, details? } }`, with no stack traces;
  - `GET /health` (liveness) and `GET /ready` (503 with per-check status while a dependency is
    down);
  - graceful shutdown: `SIGTERM`/`SIGINT` finish in-flight requests, close the database, exit 0.
- **Fullstack in a monorepo.** pnpm, npm, yarn or bun workspaces with Turborepo: the API in
  `apps/api`, a Next.js 16 or React 19 + Vite web app in `apps/web`, an optional Next.js admin
  app, and `packages/shared` with the response types and a typed client. In development the web
  apps reach the API through a `/api` proxy, so there is no CORS to configure.
- **Data, wired in.** PostgreSQL 18, MySQL 8.4, SQLite or MongoDB 8, through Prisma 7, Drizzle or
  Mongoose; Redis for caching, rate limits and sessions. The database is part of `/ready` and of
  shutdown, has `db:*` scripts, and gets a compose service when you choose Docker.
- **Auth that works end to end** (Express, Fastify or NestJS, with Prisma + PostgreSQL):
  - JWT: register, login, refresh and logout, argon2id hashes, a 15-minute access token and a
    rotating 7-day refresh token in httpOnly cookies; a reused refresh token ends every session;
  - or Better Auth: email + password, optional GitHub and Google sign-in, database sessions and
    admin roles;
  - optionally sessions in Redis instead of JWT access tokens;
  - login, register and account pages in the web apps, and `requireAuth` / `requireRole('ADMIN')`
    for your routes.
- **Security you choose, imported explicitly.** Helmet, CORS, origin checks, request logging,
  compression, and rate limiting (fixed window, sliding window, token bucket or leaky bucket,
  with `RateLimit-*` headers). A missing middleware is a compile error, never a silent no-op.
- **The rest of a real project.** Vitest or Jest with Supertest; OpenAPI at `/openapi.json` with
  a Scalar reference at `/docs`; `/v1` API versioning; ESLint 10, Prettier, Husky + lint-staged +
  commitlint; multi-stage, non-root Dockerfiles and a compose file for the whole stack; a GitHub
  Actions workflow; VS Code settings; Dependabot and issue templates; `AGENTS.md` and `CLAUDE.md`.
- **Folders for the architecture you pick.** Feature-scoped, clean, MVC or flat for the API;
  feature-based, layer-based or atomic design for the web apps.
- **A Todo app to start from** (optional, Express + Prisma): CRUD with filters and cursor
  pagination, from the Prisma model to a page in the web app, per user when you pick auth.
- **Changes later without a rewrite.** `add` and `remove` modules in an existing project; files
  you edited are never overwritten.
- **For AI assistants too.** `create-devstack-app mcp` serves DevStack over MCP, so an assistant
  can list modules, validate a stack, plan and generate it.

55 modules in all; each one has a page on the [website](https://devstack-app-delta.vercel.app/docs/modules).

## Commands

```bash
create-devstack-app my-app                        # interactive wizard
create-devstack-app my-app --preset backend --yes # a preset, no questions
create-devstack-app my-app --config stack.json    # from a stack config
create-devstack-app . --in-place                  # into the current directory
create-devstack-app my-app --dry-run              # show the plan, write nothing
create-devstack-app my-app --preset backend --print-plan json

create-devstack-app plan --preset backend         # what init would write and run
create-devstack-app modules list                  # every module, by category
create-devstack-app doctor                        # Node.js, package managers, git, Docker; in a
                                                  # project, dependencies that differ from the catalog

create-devstack-app add security-rate-limit       # in a project: add modules later
create-devstack-app remove cache-redis            # in a project: remove them again
create-devstack-app config set settings.license MIT   # remember a default
create-devstack-app presets save team-api         # keep this project's stack as a preset
create-devstack-app mcp                           # serve DevStack to AI assistants
```

Installed globally (`npm install -g create-devstack-app`), the CLI also answers to `devstack`:
`devstack add security-rate-limit`, `devstack doctor`, `devstack mcp`.

Built-in presets: `backend`, `backend-fastify`, `backend-nest`, `api-mongo`,
`fullstack-next-express` and `fullstack-vite-express`; `presets list` shows them with yours.

On the review screen you can generate, change any answer, save the stack as a preset, remember
your answers as defaults, or cancel. If installing fails after the files are written, they stay:
the summary says "Not verified" and lists the commands to run again. After the files are written
it asks whether to make the initial git commit, and only then whether to push it to an existing,
empty GitHub repository.

`plan`, `modules`, `doctor`, `add`, `remove`, `config`, `presets` and `mcp` are commands, so a
project with one of those names needs the explicit form: `create-devstack-app init doctor`.

| Flag                          | Effect                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--preset <name>`             | Start from a preset, built in or your own (`presets list`); you still see the review screen unless you pass `--yes` |
| `--modules <ids>`             | The stack as module ids, comma-separated (the website's builder writes this command)                                |
| `--option <module.key=value>` | A module option, repeatable, e.g. `security-rate-limit.limit=500`                                                   |
| `--pm <name>`                 | Package manager: `npm`, `pnpm`, `yarn` or `bun` (default: how you ran the CLI, then a lockfile here, then npm)      |
| `--depth <level>`             | `wired` (default): integration code included. `bare`: config, tooling and folders only                              |
| `--module-system <system>`    | `esm` (default) or `cjs`: how the API's code is loaded. Web apps stay ESM                                           |
| `--config <file>`             | Generate from a stack config, e.g. another project's `.devstack/stack.json`                                         |
| `--yes`                       | Accept defaults, never ask. Never overwrites existing files                                                         |
| `--force`                     | Overwrite existing files. Originals are backed up first                                                             |
| `--advanced`                  | Pick modules one by one; the review screen offers fixes when they do not fit together                               |
| `--in-place`                  | Generate into the current directory                                                                                 |
| `--dry-run`                   | Print the plan (files and commands) and stop                                                                        |
| `--print-plan [text\|json]`   | Print the plan in a format; `json` never prompts                                                                    |
| `--skip-install`              | Do not install dependencies                                                                                         |
| `--skip-git`                  | Do not initialise git or install hooks                                                                              |
| `--skip-verify`               | Skip the checks and boot test after install (the project is "Not verified")                                         |
| `--github <url>`              | Push the initial commit to this existing, empty GitHub repository                                                   |
| `--start`                     | Start the database and the dev servers when the project is ready                                                    |
| `--verbose`                   | Debug output and full error details                                                                                 |

Exit codes: `0` success, `1` generation failed after writing (the message lists what was written),
`2` invalid input or stack (nothing written), `3` cancelled.

### Stack config

```json
{
  "version": 1,
  "name": "acme-api",
  "packageManager": "pnpm",
  "modules": [
    "framework-express",
    "orm-prisma",
    "security-helmet",
    { "id": "security-rate-limit", "options": { "limit": 500 } }
  ]
}
```

A module entry can be an id or `{ "id", "options" }`; options are validated against the
module's schema, and defaults fill in the rest (rate limiting: `windowMs`, `limit`). The JSON
Schema for this file is published at
[`/schema/stack.json`](https://devstack-app-delta.vercel.app/schema/stack.json).

A config can also carry `settings`, recorded with every project:

```json
"settings": {
  "style": { "semi": true, "singleQuote": false, "tabWidth": 4, "printWidth": 100 },
  "strictness": "strictest",
  "moduleSystem": "cjs",
  "apps": { "backend": "server", "frontend": "site" },
  "ports": { "backend": 4000 },
  "license": "MIT",
  "author": "Ada Lovelace",
  "initialCommit": true
}
```

The code style goes into `.prettierrc` and every generated file follows it; `strictest` adds
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noImplicitOverride`;
`moduleSystem: "cjs"` makes the API CommonJS (the source stays TypeScript); `apps` and
`ports` rename the monorepo's apps everywhere (folders, compose, Dockerfiles, env).

Every generated project records its own config in `.devstack/stack.json`; passing it to
`--config` regenerates the same files.

### Change a project later: add and remove

Run in a generated project's root folder:

```bash
create-devstack-app add cache-redis --dry-run     # list the changes first
create-devstack-app add cache-redis               # write them, then install
create-devstack-app remove cache-redis
```

DevStack compares what it generated, what the stack needs now, and what is on disk. Files you
have not touched are updated, created or (on `remove`) deleted. A file you edited is never
overwritten: the new version is written next to it as `<file>.devstack-new` for you to merge,
or `--force` overwrites it after a backup. `package.json` and `pnpm-workspace.yaml` are merged
and new variables are appended to `.env`. `remove` refuses a module another one still needs.

### Remembered defaults and your presets

```bash
create-devstack-app config set packageManager pnpm
create-devstack-app config set settings.style.semi true
create-devstack-app config list                   # also: get, unset, path
create-devstack-app presets save team-api --description "Team API"
create-devstack-app presets list                  # also: show, delete
```

Defaults live in `~/.config/devstack/config.json` (or `$XDG_CONFIG_HOME/devstack`): the wizard
pre-selects them and `--yes` uses them. "Remember as my defaults" on the review screen saves
your answers. Flags win over a `--config` file, which wins over a preset, which wins over your
defaults. Presets are saved in `~/.config/devstack/presets/` and work with `--preset <name>`.

### Use from AI assistants (MCP)

`create-devstack-app mcp` is a local MCP server over stdio: your AI assistant starts it, no
hosting involved. It offers `list_modules`, `list_presets`, `validate`, `plan`, `init`,
`add_modules` and `remove_modules`. Add it to Claude Code with
`claude mcp add devstack -- npx create-devstack-app mcp`, or to any client's config:

```json
{ "mcpServers": { "devstack": { "command": "npx", "args": ["create-devstack-app", "mcp"] } } }
```

`init` only writes into a new or empty folder given as an absolute path, and the add and
remove tools keep the same rules as the commands.

## Safety

- Nothing is written until the whole plan has rendered. Files are staged in a temp directory,
  then copied in.
- `--yes` never overwrites. With `--force` or an interactive "overwrite", originals are copied to
  a backup directory first and the summary says where. `init` never deletes anything; `remove`
  deletes only files it generated that you have not changed, after backing them up.
- Symlinks, non-regular files and paths outside the project are refused before anything is written.
- Project names follow npm's rules, including reserved and Windows device names.
- Commands run without a shell, and the package runs no install scripts.
- Every release is built and published by GitHub Actions from a tagged commit, with npm
  provenance; check it with `npm audit signatures` in a project that depends on the package.
  Third-party code bundled into the CLI is listed with its licences in
  `dist/THIRD_PARTY_NOTICES.md`.

## Develop

```bash
npm install
npm run dev -- my-app --dry-run   # run the CLI from source
npm test                          # unit tests
npm run test:coverage             # with coverage
npm run e2e                       # smoke: 4 stacks on pnpm, in parallel (~1 min)
npm run e2e:full                  # every stack on npm, pnpm, yarn and bun (~10 min)
npm run e2e -- --only fullstack-docker --keep   # one stack, keeping the project
npm run release:smoke             # the packed CLI through npx, pnpm dlx, bunx and both bins
npm run lint && npm run typecheck && npm run build
npm run graph                     # knowledge graph of the codebase in graphify-out/ (needs uv)
```

The end-to-end harness (`tests/e2e`) packs the CLI as npm publishes it, generates every
combination in `tests/e2e/matrix.json`, and checks each project: install, required files, lint,
format, typecheck, build, and boot with `/health`, security headers and a clean `SIGTERM` exit.

### How generation works

`src/core/planner` resolves the modules and builds a plan: every file and command, as data. Eta
templates (`*.eta`) render framework entry points and fill their slots with fragments from the
selected modules. `src/core/apply` then checks paths, applies the conflict policy, stages and
writes the files, and runs the commands. Versions come only from `src/catalog/node.ts`.

### Add a module

1. Create `src/modules/<language>/<category>/<name>/index.ts` exporting a `DevstackModule`
   (language-agnostic modules such as databases go under `common/`), and register it with its
   folder in `src/modules/registry.ts`. The module's `id` is separate from its folder and never
   changes once released.
2. List packages by name. Add their versions to `src/catalog/node.ts`; a test rejects literal
   versions in modules.
3. Put templates in the module's `files/` folder (`filesPath: moduleFilesPath('node/orm/prisma')`). Name a file
   `*.eta` to render it; store `.gitignore` as `gitignore`.
4. Contribute framework code through `slots` (`app.imports`, `app.middleware`), environment
   variables through `env`, and post-install steps through `commands`.
5. Add tests, and add a combination to `tests/e2e/matrix.json`.

| Document                                                                           | What it covers                                        |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [buildPlan.md](https://github.com/3ncryptor/DevStack/blob/main/buildPlan.md)       | The product, the architecture and every decision (§7) |
| [docs/adr](https://github.com/3ncryptor/DevStack/blob/main/docs/adr/README.md)     | The decisions, indexed                                |
| [RELEASING.md](https://github.com/3ncryptor/DevStack/blob/main/RELEASING.md)       | How a release is verified, rehearsed and published    |
| [CHANGELOG.md](https://github.com/3ncryptor/DevStack/blob/main/CHANGELOG.md)       | What changed in each version                          |
| [CONTRIBUTING.md](https://github.com/3ncryptor/DevStack/blob/main/CONTRIBUTING.md) | How to contribute                                     |
| [SECURITY.md](https://github.com/3ncryptor/DevStack/blob/main/SECURITY.md)         | Reporting a vulnerability privately                   |

## License

[MIT](https://github.com/3ncryptor/DevStack/blob/main/LICENSE)
