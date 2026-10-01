# DevStack — Build Plan

**Status:** Active. This is the main document for DevStack development.
**Last updated:** 2026-09-30
**Supersedes:** `DEVSTACK-MASTER-DOC.md` (its decisions are carried into §7; its
"as-built" section described code that does not exist and must not be trusted).

## How to use this document

- Part A0 is the **user-facing view**: what a developer types, what the
  wizard asks, and what they have when DevStack finishes. Start here.
- Part A is the **product** plan: who DevStack is for, what it must do, what it
  must not do, and in which order features earn their place.
- Part B is the **architecture**: the concepts, contracts, and pipeline every
  phase builds on. Code that disagrees with Part B is wrong until a decision in
  §7 says otherwise.
- Part C is the **execution plan**: phases, tasks, gates. Do not start a phase
  before the previous phase's exit gate is green.
- §7 is the **decision log**. Any choice that affects more than one module or
  one phase gets a dated entry here before it is implemented. Re-litigating a
  logged decision requires a new entry that references the old one.
- §8 lists **open questions** with an owner and the phase that must resolve
  them.

Precedence: `buildPlan.md` > `README.md` > code comments. When code and this
document disagree, fix one of them in the same PR.

---

# Part A0 — What DevStack gives you

The user-facing view: what a developer types, what they are asked, and what they have when
DevStack finishes. Later parts specify how. If this part and a §7 decision disagree, the
decision wins and this part is fixed in the same PR.

## A0.1 Invocation

```
npx create-devstack-app my-app          # positional name
npx create-devstack-app --name my-app   # flag form
npm create devstack-app@latest my-app   # npm create form
npx create-devstack-app .               # into the current, empty folder
npx create-devstack-app                 # asks for the name first
```

`create-devstack-app` is a placeholder until Q-01 is resolved. `npx create devstack` cannot
work (it runs a package named `create`), and `npm create devstack` resolves to
`create-devstack`, which is taken. The project name is validated before any question
(npm rules, no `..`, no absolute paths; a non-empty target folder triggers the conflict policy).

Every wizard question has a flag (B11), `--yes` takes remembered or built-in defaults, and
`--config stack.json` answers everything (B12).

## A0.2 The wizard (D-34)

A pre-flight check runs first (D-44): Node version, package managers installed, git
`user.name`/`user.email` set; Docker running is checked once compose is selected. Questions
that do not apply are skipped, only compatible options are shown, and ★ marks the default.

| #   | Question                  | Options                                                                                                                 | Notes                                                                                                  |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0   | Start from a stack preset | Custom ★ · `backend-express-prisma` · `backend-fastify-drizzle` · `backend-nest` · `fullstack-next-hono` · user presets | A preset pre-fills every answer; the user still reviews at #20                                         |
| 1   | App type                  | Backend · Frontend · Fullstack                                                                                          | Sets the layout: fullstack → monorepo (workspaces + Turborepo), otherwise single; `--layout` overrides |
| 2   | Backend framework         | Express ★ · Fastify · Hono · NestJS                                                                                     | backend, fullstack                                                                                     |
| 3   | Frontend framework        | Next.js ★ · React + Vite                                                                                                | frontend, fullstack                                                                                    |
| 4   | Styling                   | Tailwind ★ · CSS Modules · None                                                                                         | frontend, fullstack (D-42)                                                                             |
| 5   | Database                  | None · Postgres ★ · MySQL · SQLite · MongoDB; then "Add Redis?"                                                         | backend, fullstack                                                                                     |
| 6   | ORM                       | Prisma ★ · Drizzle (SQL engines) · Mongoose (MongoDB)                                                                   | filtered by the database                                                                               |
| 7   | Auth                      | None ★ · Email + password (JWT) · Sessions (adds Redis) · Better Auth, then OAuth providers: GitHub, Google             | requires a database; OAuth client id/secret left blank in `.env` and listed in the summary (D-38)      |
| 8   | Package manager           | npm · pnpm ★ · yarn · bun                                                                                               | managers that are not installed are marked, with an install hint                                       |
| 9   | Backend architecture      | Flat · MVC · Feature-scoped ★ · Clean                                                                                   | each option previews its folder tree; the frontend uses its framework's idiomatic layout (D-37)        |
| 10  | App template              | None — clean setup ★ · Todo · Weather                                                                                   | opt-in domain code (B17.8, D-39)                                                                       |
| 11  | Pre-commit hooks          | Yes ★ · No                                                                                                              | Husky + lint-staged + commitlint + secret scanning (Q-13)                                              |
| 12  | Tests                     | Vitest ★ · Jest · None                                                                                                  | backend adds Supertest; frontend adds Testing Library                                                  |
| 13  | Dockerfile                | Yes ★ · No                                                                                                              | one per app: multi-stage, non-root, PM-aware                                                           |
| 14  | Docker Compose            | Yes (★ when a database is selected) · No                                                                                | data services + api + web, all with healthchecks (D-41)                                                |
| 15  | API docs                  | Scalar ★ · No                                                                                                           | backend only                                                                                           |
| 16  | App setup (`app.ts`)      | CORS ✓ · Helmet ✓ · Rate limit ✓ · Request logging ✓ · Compression                                                      | multiselect; security pre-checked (D-36)                                                               |
| 17  | CI                        | GitHub Actions ★ · None                                                                                                 |                                                                                                        |
| 18  | Repo extras               | `AGENTS.md` + `CLAUDE.md` ✓ · VS Code setup ✓ · GitHub hygiene files ✓                                                  | multiselect (B17.9, D-45)                                                                              |
| 19  | Connect a GitHub repo     | No ★ · Yes → paste the repo URL                                                                                         | A0.5 (D-40)                                                                                            |
| 20  | Review                    | every answer, file count, versions → Generate · Edit an answer · Save as preset · Remember as my defaults · Cancel      | nothing is written before this screen                                                                  |

**Always configured, never asked (D-35, D-36):** ESLint 10 flat config, Prettier with
`.prettierrc`, `.editorconfig`, `tsconfig`, `.gitignore`, `.env` + `.env.example`, Zod env
validation, pino logger, error handler and error envelope, request id, graceful shutdown,
database connection lifecycle (connect on start, close on stop), `/health` and `/ready`, a
README for the chosen stack, `.gitkeep` in empty architecture folders, `.devstack/stack.json`.

## A0.3 Health routes: working however the project is started

| App type      | Health surface                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Backend       | `GET /health` → `{ status: "ok", uptime }`, never touches dependencies; `GET /ready` → per-dependency checks, 503 if any fail |
| Frontend only | Next.js: `app/health/route.ts` → 200. React + Vite: `/health` served by nginx in the Docker image                             |
| Fullstack     | both, plus the web home page shows **API ✓ connected · DB ✓ connected** from `/api/ready` through the dev proxy               |

| Start method         | Result                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `dev` (any PM)       | `/health` OK immediately; `/ready` reports the database down until `db:up`, with a log line saying so |
| `docker compose up`  | data services → api → web start in order via healthchecks; everything green                           |
| `build` then `start` | same as `dev`, with production logging                                                                |

## A0.4 After the review screen

1. Files are written through a staging directory with rollback (B3).
2. Install, then lint, typecheck and tests run.
3. **Boot verification** (D-44): the app starts, `/health` (and `/ready` when data services are
   up) is called, and the app is stopped with SIGTERM. The summary shows "Verified ✓".
4. `git init -b main`; `.gitignore` is confirmed to cover `.env` before anything is staged;
   commit `chore: initial project setup (devstack)` with hooks running normally.
5. If a GitHub URL was given, push (A0.5), only after steps 2 and 3 pass.
6. Summary: next commands, env vars to fill, permissive-default warnings, repo link.
7. **"Start it now?"** (opt-in, default No): runs `db:up` and `dev` and opens the browser at the
   status page. The user asks for it, so D-33 holds.

## A0.5 GitHub connect (D-40)

- Accepts `https://github.com/<owner>/<repo>(.git)` or `git@github.com:<owner>/<repo>.git`;
  anything else is rejected. The URL reaches git as an argument, never through a shell.
- `git ls-remote` confirms the repo is reachable and empty. A repo with commits (for example a
  README created on GitHub) stops the step with an explanation. DevStack never force-pushes.
- Confirms "Push to <url> on main?" (skipped only when both `--github` and `--yes` are given),
  then `git remote add origin` and `git push -u origin main`.
- Uses the user's existing git credentials (SSH, credential helper, `gh`). DevStack never asks
  for, reads or stores tokens.
- A failed push does not fail generation: the project stays, the exit code is 0, and the summary
  prints the exact retry command.

## A0.6 Release order and deferrals

What a user can do at each version is in A9. Considered on 2026-09-30 and deferred to
post-1.0 (D-46): shadcn/ui, TanStack Query, a Quick/Detailed wizard mode, extra services
(email + Mailpit, file storage + MinIO, BullMQ jobs, DB admin UI), deploy targets, creating the
GitHub repo via `gh`, Sentry/OpenTelemetry, WebSockets, a Stripe template, Expo, tRPC,
devcontainer.

---

# Part A — Product

## A1. Thesis

Developers lose the first day of every project to the same decisions: runtime,
package manager, framework, ORM, auth, lint, CI, Docker, repo layout. Every
team has a preferred answer to each, and every combination has integration
details that are easy to get subtly wrong (Nest + esbuild decorators, Prisma +
Docker, ESLint 10 flat config, pnpm + Husky).

DevStack is a **stack orchestrator**: the developer describes the stack they
want, and DevStack produces a **running, wired system**, not just installed
packages. The database is connected, the frontend talks to the backend
through a dev proxy, errors, logging, env validation, health checks and
graceful shutdown are in place, and a test suite is green. The repository
passes its own lint/typecheck/test/build gates on the first run and is laid
out so it can grow (single app today, monorepo tomorrow) without a rewrite.

The measure of success: the developer's first commit is business logic, not
plumbing. Everything in the SDLC between "choose a stack" and "write the
first feature" is DevStack's job.

The product is not the templates. It is the **composition engine** that makes
any valid combination of modules produce a working project, plus the
**personalisation surface** that lets a developer express their preferences
once and reuse them.

## A2. Positioning and competitive landscape

| Tool                                                        | What it does well                                                                                   | Where DevStack differs                                                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-better-t-stack`                                     | Broad TS fullstack matrix (frontends, DBs, ORMs, auth, addons), web stack builder, MCP server mode. | TS-only, opinionated toward its own stack. DevStack targets multi-language (TS/Python/Go), backend-first depth, and a module contract designed for third-party modules later. |
| `create-t3-app`                                             | Opinionated Next.js stack, excellent DX.                                                            | Single stack, no backend-only or monorepo modes.                                                                                                                              |
| Nx / Turborepo generators                                   | Monorepo tooling, task graph.                                                                       | They assume you already chose a stack. DevStack generates _into_ a Turborepo/pnpm workspace; it does not replace it.                                                          |
| Cookiecutter / Copier (Python)                              | Template + variables, Copier supports updates.                                                      | Template-centric, no composition of independent modules, no dependency conflict resolution.                                                                                   |
| Projen                                                      | Config-as-code that owns project files forever.                                                     | Heavier ownership model; DevStack generates once (with optional `add`) and then gets out of the way.                                                                          |
| Framework CLIs (`nest new`, `django-admin`, `gin` starters) | Perfect for one framework.                                                                          | No cross-cutting concerns (auth, CI, Docker, monorepo).                                                                                                                       |

**Positioning statement:** _DevStack is the one CLI you run to start any
project — backend, frontend, fullstack, or multi-language — and get a
production-shaped repository that reflects your stack preferences, not ours._

## A3. Users and jobs-to-be-done

| Persona                       | Job                                                          | What they need from DevStack                                                         |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Solo builder / indie hacker   | Start a side project tonight                                 | Fast wizard, sane defaults, `--yes`, one preset that just works                      |
| Backend engineer at a startup | Spin up a new service that matches the team's conventions    | Config-file replay, package-manager choice, security middleware on by default        |
| Platform / DevOps engineer    | Standardise how teams bootstrap repos                        | Presets they can define and share, CI/Docker/observability modules, monorepo layouts |
| Polyglot team                 | Same bootstrapping experience for TS, Python and Go services | Language adapters with identical CLI flow                                            |
| AI-assisted developer         | Let an agent scaffold the project from a description         | Non-interactive mode, JSON plan output, MCP server mode (later)                      |

## A4. Product principles

1. **Every generated project passes its own gates.** `install`, `lint`,
   `format`, `typecheck`, `test`, `build` and a smoke run must succeed
   immediately after generation, for every combination we ship. This is the
   one non-negotiable quality bar and it is enforced by CI, not by review.
2. **Personalisation is an axis, not a fork.** Language, package manager,
   repo layout, framework, ORM, etc. are independent choices. Adding a value
   to one axis must not require touching modules on another axis.
3. **Secure by default, loud when not.** Security middleware is on in presets.
   When a default is permissive (e.g. CORS `*` with no allowlist) the
   generated project says so at startup and in its README.
4. **Nothing silent.** No swallowed errors, no silent overwrites, no
   middleware that vanishes because an import failed.
5. **Declarative in, deterministic out.** The same stack spec produces the
   same file tree. That is what makes dry-run, replay, testing and `add`
   possible.
6. **Generate, don't own.** After generation the repo belongs to the
   developer. DevStack leaves one small manifest (`.devstack/stack.json`) so
   it can add modules later, and nothing else.
7. **Boring, current tooling.** Ship the current stable of each tool
   (Node 24/26, ESLint 10 flat config, Prisma 7, pnpm 10, uv). Pinned in one
   version catalog, updated on a schedule, never hardcoded in modules.
8. **Wired, not installed.** Selecting a module means its integration code
   is written and connected: Prisma + Postgres means a client, a connection
   check, shutdown handling, migrations, seed, a compose service and a real
   `/ready` probe, not just two packages in `package.json`.
9. **No code to delete.** At the default depth DevStack generates plumbing,
   never sample business logic. Domain code exists only when the user picks
   an app template (`--template`, D-39).
10. **Layered output.** Generated code follows ports and adapters (domain
    services depend on interfaces; ORM and framework code are adapters). This
    keeps the generated codebase clean for the user and keeps DevStack's
    integration work additive instead of multiplicative (B17.6).

## A5. Current state (2026-09-28)

Working prototype, v0.1.0, ~2.6k lines TS, 16 Node modules, one preset. The
CLI's own lint/test/build pass. The generated projects do **not** pass their
own gates (ESLint `no-require-imports`, unformatted `.lintstagedrc.json`,
missing `@types/express` on Nest combinations). Security middleware is loaded
via runtime `require()` inside a bare `catch`, so a failed import disables it
silently. `--yes` overwrites files without confirmation. The npm name
`create-devstack` is owned by someone else. Test coverage is limited to
composer/validator/loader. No templating, no dry-run, no config replay, no
monorepo, one language.

Everything in Part C Phase 0 exists to close these gaps before adding breadth.

## A6. Personalisation model

Personalisation has five layers. Each is independent, and the 1.0 scope of
each was fixed on 2026-09-28 (D-21..D-33).

### Layer 1 — Stack axes (what gets generated)

A stack is a point in this space. Every axis is independent; the resolution
engine (Part B) rejects invalid points with a clear message.

**Breadth policy (D-23):** 2–4 fully integrated options per axis. "Fully
integrated" means: slot fragments for every framework the option supports,
present in the e2e matrix, and passing principle 1. There is no
"community/untested" tier. Every backend framework multiplies the integration
work of every cross-cutting module, so framework count is held deliberately.

| Axis                    | 1.0                                                                                                           | Post-1.0                                        | Scope                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------- |
| **Language**            | Node/TS                                                                                                       | Python (uv), Go                                 | Per app target            |
| **Runtime**             | Node                                                                                                          | Bun runtime                                     | Per app target            |
| **Package manager**     | npm, pnpm, yarn, bun                                                                                          | uv, go                                          | Per repo                  |
| **Repo layout**         | single, monorepo                                                                                              | —                                               | Per repo                  |
| **Monorepo tooling**    | pnpm/yarn/bun/npm workspaces + Turborepo                                                                      | Nx, uv workspaces, go.work                      | Per repo                  |
| **Backend framework**   | Express, Fastify, Hono, NestJS                                                                                | Koa; FastAPI, Django, Flask; Gin/chi, Fiber     | Per app target            |
| **Frontend framework**  | Next.js, React+Vite                                                                                           | SvelteKit, Nuxt, Astro, Angular                 | Per app target            |
| **Styling**             | Tailwind, CSS Modules, none (D-42)                                                                            | shadcn/ui                                       | Per frontend target       |
| **API style**           | REST                                                                                                          | tRPC, GraphQL (Yoga)                            | Per backend target        |
| **Database**            | Postgres, MySQL, SQLite, MongoDB, Redis (cache)                                                               | —                                               | One primary; caches multi |
| **ORM / query layer**   | Prisma, Drizzle, Mongoose                                                                                     | TypeORM; SQLAlchemy; sqlc/GORM                  | Per backend target        |
| **Auth**                | JWT, session (Redis), Better Auth with GitHub/Google OAuth (D-38)                                             | standalone OAuth modules, Clerk, WorkOS         | Per backend target        |
| **Env / config**        | Zod env schema                                                                                                | pydantic-settings, envconfig                    | Per app target            |
| **Validation**          | Zod (Express/Fastify/Hono), class-validator (Nest) — ships with framework                                     | —                                               | Bound to framework        |
| **Testing**             | Vitest + Supertest; Jest alternative; Testing Library (frontend)                                              | Playwright; pytest; go test                     | Per app target            |
| **Quality**             | ESLint 10 + Prettier, always on (D-35); pre-commit bundle: Husky + lint-staged + commitlint + secret scanning | lefthook; ruff/mypy; golangci-lint              | Multi                     |
| **Architecture layout** | flat, MVC, feature-scoped, clean (D-37)                                                                       | hexagonal                                       | Per app target            |
| **DevOps**              | Docker (multi-stage, non-root), compose (whole stack, D-41), GitHub Actions                                   | GitLab CI, Vercel, Fly.io, Railway              | Multi                     |
| **Observability**       | pino, health/readiness endpoints                                                                              | OpenTelemetry, Sentry                           | Multi                     |
| **API docs**            | OpenAPI + Scalar; Swagger on Nest                                                                             | Redoc                                           | Per backend target        |
| **App template**        | none, Todo, Weather (D-39)                                                                                    | more domains                                    | Per repo                  |
| **Repo extras**         | `AGENTS.md` + `CLAUDE.md`, VS Code setup, GitHub hygiene files (D-45)                                         | devcontainer                                    | Per repo                  |
| **Git / GitHub**        | git init + initial commit; connect an existing empty GitHub repo (D-40)                                       | create the repo via `gh`                        | Per repo                  |
| **AI starters**         | —                                                                                                             | agent scaffold, RAG starter, MCP server starter | Per app target            |

### Layer 2 — Structure and style (how the code looks)

Cheap, highly personal, and what makes the output feel like the user's code
rather than ours. All in 1.0 (D-24).

| Knob             | Values                                                                                                                            | Applied to                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Code style       | semicolons, single/double quotes, tab width, trailing commas, print width                                                         | Prettier config **and** the generated files themselves (formatted at plan time so output matches) |
| TS strictness    | `standard` (`strict`) / `strictest` (`+ noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)            | every `tsconfig`                                                                                  |
| Module system    | ESM (default) / CJS                                                                                                               | tsconfig, package.json `type`, templates                                                          |
| Naming           | monorepo app folder names (`apps/api` vs `apps/server`), source dir, port                                                         | targets, templates                                                                                |
| Project metadata | license, author, description, private/public, initial commit on/off                                                               | manifest, LICENSE, git                                                                            |
| Module options   | per-module Zod-validated knobs: rate-limit window/limit, CORS allowlist, DB name/user, Node version, CI matrix, Docker base image | the owning module's templates                                                                     |

### Layer 3 — Input surface (how you tell us)

| Mode                                                                                                             | Primary user                        | 1.0       |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------- |
| Wizard (basic): fixed question order (A0.2), only compatible choices shown, defaults pre-selected, review screen | first-time, solo                    | ✅        |
| Advanced: flat picker with live resolver diagnostics                                                             | power users                         | ✅        |
| Flags: every axis addressable (`--pm pnpm --framework fastify --orm drizzle …`)                                  | scripts, docs, agents               | ✅        |
| Built-in presets                                                                                                 | everyone                            | ✅        |
| User presets: save any wizard result as a named preset in `~/.config/devstack/presets/`                          | teams, repeat users                 | ✅        |
| Config file: `stack.json` in, `.devstack/stack.json` out                                                         | teams, CI, agents                   | ✅        |
| `--dry-run` / `--print-plan [json]`                                                                              | cautious users, agents              | ✅        |
| `devstack add <module>`: post-hoc addition driven by the manifest                                                | everyone, later in a project's life | ✅ (D-25) |
| `devstack mcp`: stdio MCP server exposing list/plan/init                                                         | AI-assisted developers              | ✅ (D-25) |
| Web stack builder → config file                                                                                  | discovery, marketing                | post-1.0  |

### Layer 4 — Starter depth (how much code is written for you)

`--depth bare | wired` (D-27, amended by D-39). Default `wired`. Domain code comes only from
an app template, `--template none | todo | weather`, which builds on `wired`.

| Depth              | What you get                                                                                                                                                                                                                                                                                                                                     | For whom                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `bare`             | Config, tooling, manifests, folder structure. No integration code.                                                                                                                                                                                                                                                                               | Users who want DevStack to pick and pin tools but write all code themselves |
| `wired` (default)  | Everything connected and running: entry point, app factory, env validation, logger, error handling, security middleware, health/ready, DB client + migrations + seed + compose, dev proxy + shared API client (fullstack), auth routes and middleware (if auth selected), a green test suite, a generated README. **Zero business-domain code.** | Most users: start writing features immediately                              |
| `wired` + template | One complete domain end-to-end (B17.8): **Todo** (CRUD, filters, pagination, per-user when auth is selected) or **Weather** (external API proxy with caching, no database). Schema → repository → service → routes → validation → tests → frontend pages.                                                                                        | Learners, teams who want a reference pattern, obvious apps                  |

The full contents of each depth are specified in B17.

### Layer 5 — Remembered defaults (answer once)

`~/.config/devstack/config.json` (D-24) stores: preferred package manager,
code style, TS strictness, starter depth, license, author, default quality
tools, "always include Docker/CI". The wizard pre-selects from it, `--yes` uses it, and any
flag overrides it. Precedence: flags > config file > user preset > remembered
defaults > built-in defaults.

### Deliberately not personalisable

- Whether security middleware _exists_: always available, on by default in
  presets, removable per module — never a hidden toggle.
- Core entry-point file names (`src/app.ts`, `src/server.ts`): slots depend
  on them.
- More than one framework / ORM / auth per target: the resolver enforces it.
- Lint and format tooling: ESLint + Prettier, always (D-35).
- Graceful shutdown, connection lifecycle, health and readiness: always generated (D-36).
- Dependency versions: catalog only. A `--latest` escape hatch is a post-1.0
  discussion.

## A7. Feature backlog, prioritised

Priority is RICE-style but expressed as tiers. "Reach" = how many personas
need it; "Impact" = how much it changes the outcome; "Confidence" = how well
we understand it; "Effort" = S/M/L/XL.

### P0 — Must ship before any breadth (Phase 0–1)

| Feature                                                                                                                                             | Why                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Generated projects pass own gates, enforced by e2e CI matrix                                                                                        | Principle 1; today's headline bug                         |
| Rename package (npm name taken)                                                                                                                     | Cannot publish or safely document `npx` otherwise         |
| Slot-based code injection replaces runtime `require()`                                                                                              | Fixes silent security bypass and lint failure at the root |
| Central version catalog                                                                                                                             | Prevents cross-module version conflicts; enables Renovate |
| Deterministic plan + `--dry-run` + `--print-plan`                                                                                                   | Foundation for tests, replay, `add`, agents               |
| Stack config file (in/out) + `.devstack/stack.json` manifest                                                                                        | Replay, team standards, AI agents                         |
| Safe overwrite semantics; strict project-name validation                                                                                            | Principle 4; path-traversal edge (`..`)                   |
| Post-generation summary (next steps, env vars to fill, warnings)                                                                                    | DX bar; needed before auth modules                        |
| Modern toolchain in generated projects (Node 24+, ESLint 10 flat, Prisma 7)                                                                         | Principle 7; ESLint 9 is EOL                              |
| Backend golden-path baseline at `wired` depth (entry, app factory, env, logger, errors, health/ready, graceful shutdown, test) for Express and Nest | Principle 8; replaces today's thin templates              |

### P1 — Core personalisation (Phase 2–3)

| Feature                                                                                                                                         | Effort |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Package manager as an explicit choice (`--pm`), plus lockfile-aware Docker/CI/hooks                                                             | M      |
| Monorepo layout: pnpm workspaces + Turborepo default; yarn/bun/npm workspace variants                                                           | L      |
| Backend breadth: Fastify, Hono                                                                                                                  | M each |
| ORM breadth: Drizzle, Mongoose; database as its own category                                                                                    | M each |
| Testing modules (Vitest/Jest + Supertest) that know the selected framework                                                                      | M      |
| GitHub Actions module; DB-aware compose; multi-stage non-root Dockerfile                                                                        | M      |
| Env schema module (Zod) generated from all modules' `env` declarations                                                                          | M      |
| DB wiring per ORM × database: client, connection check, shutdown, migrations, seed, compose service with healthcheck, real `/ready`             | L      |
| Frontend frameworks + `packages/shared` + one fullstack preset                                                                                  | L      |
| Fullstack wiring: dev proxy (Next rewrites / Vite proxy), shared typed API client, single ports config, root `dev`, "API ✓ DB ✓" first-run page | M      |
| App templates, backend and frontend: Todo and Weather end-to-end (B17.8)                                                                        | L      |
| Guided wizard in the A0.2 order with review screen and pre-flight check                                                                         | M      |
| Finish pipeline: boot verification, git init + initial commit, GitHub connect, "Start it now?" (B18)                                            | M      |
| Frontend styling: Tailwind, CSS Modules                                                                                                         | M      |
| Repo extras: `AGENTS.md`/`CLAUDE.md`, VS Code setup, GitHub hygiene files; secret scanning in pre-commit                                        | M      |

### P2 — Depth and personalisation extras (Phase 4–5, in 1.0)

| Feature                                                                                                                                         | Effort |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Auth: JWT, session+Redis, Better Auth with GitHub/Google OAuth — wired as `User` model, hashing, `requireAuth`, register/login/me routes, tests | L      |
| Frontend auth pages at `wired` whenever auth + frontend (D-43); per-user Todo template with ownership tests                                     | M      |
| Observability: pino, readiness/liveness probes                                                                                                  | S      |
| API docs: OpenAPI + Scalar (framework-aware), Swagger on Nest                                                                                   | M      |
| Code style + TS strictness + module-system knobs, applied to output                                                                             | M      |
| Remembered defaults (`~/.config/devstack/config.json`) + user presets                                                                           | S      |
| `devstack add <module>`                                                                                                                         | L      |
| `devstack mcp` (stdio MCP server)                                                                                                               | M      |

### P3 — Post-1.0: multi-language (1.1 / 1.2)

| Feature                                                                                                 | Effort |
| ------------------------------------------------------------------------------------------------------- | ------ |
| Language adapter interface; Node adapter refactor (interface lands in 1.0, second implementation after) | M      |
| Python adapter (uv) + FastAPI + SQLAlchemy + pytest + ruff                                              | L      |
| Go adapter + Gin/chi + sqlc/GORM + golangci-lint                                                        | L      |
| Mixed-language monorepo (`apps/api` Go, `apps/web` Next)                                                | L      |

### P4 — Post-1.0: breadth and platform

| Feature                                                                                                                                               | Notes                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Standalone OAuth modules, Clerk/WorkOS wrappers; OpenTelemetry, Sentry                                                                                | Follow the auth/observability patterns proven in 1.0 |
| Koa; SvelteKit, Nuxt, Astro, Angular; tRPC, GraphQL; TypeORM                                                                                          | Breadth once contract is frozen                      |
| shadcn/ui, TanStack Query, Quick/Detailed wizard mode; extra services (email + Mailpit, MinIO, BullMQ, DB admin UI); deploy targets; `gh repo create` | Considered 2026-09-30, deferred (D-46)               |
| Web stack builder that emits a config file                                                                                                            | Marketing + DX; static site                          |
| AI project starters (agent, RAG, MCP server templates)                                                                                                | Fit the same module system                           |
| External module loading (npm packages)                                                                                                                | Requires signing/sandboxing story; deliberately last |
| Kubernetes / Terraform manifests                                                                                                                      | Low value-to-effort; after everything above          |

### Explicit non-goals (this planning horizon)

- Owning project files after generation (Projen model)
- Hosted registry / marketplace
- Sandboxing third-party `postInstall` code
- GUI desktop app

## A8. Success metrics

| Metric                                                               | Target                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| e2e matrix pass rate (generate → install → gates → smoke)            | 100% on `main`, always                                                            |
| Pushes of projects that did not pass boot verification               | 0                                                                                 |
| Time from `npx` to a running `/health` (backend preset, warm cache)  | < 90 s                                                                            |
| Commands from generation to the "API ✓ DB ✓" page (fullstack preset) | 2 (`db:up`, `dev`), 1 (`docker compose up`), or 0 with "Start it now?"            |
| Integration-matrix rows with an e2e test                             | 100%                                                                              |
| Modules shipped                                                      | 1.0: ~40 (Node-complete); 1.2: ~60 (Python + Go)                                  |
| Combinations covered by e2e                                          | every preset + every module in at least one combination per framework it supports |
| Unit/integration coverage of `src/core`                              | ≥ 80% lines, ≥ 90% for resolver                                                   |
| Time to write a new simple module (copy existing, tests green)       | < 1 hour                                                                          |
| Issues tagged `generated-project-broken` open > 7 days               | 0                                                                                 |

## A9. Release milestones

Milestones follow the vertical-slice order (D-47): after the foundation and engine, one
combination is built end to end before breadth. Part C's phase numbering is kept for task
references; the milestone column says where each task actually lands.

| Version | Milestone                                                     | Contents                                                                                                                                                                                                                                                                                                      | Part C tasks                                                                   |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 0.2.0   | M0 Foundation                                                 | Published as `create-devstack-app`, gates green, e2e harness, slots, version catalog, dry-run, config file, modern toolchain                                                                                                                                                                                  | Phase 0                                                                        |
| 0.3.0   | M1 Engine                                                     | Contract v2, resolver, PM adapters, env declarations, `--depth`, guided wizard (A0.2) with pre-flight, golden-path backend (Express, Nest) with Prisma + Postgres wired                                                                                                                                       | Phase 1                                                                        |
| 0.4.0   | M2 Vertical slice                                             | Express + Prisma + Postgres + Next.js + Tailwind on pnpm + Turborepo: fullstack wiring, Vitest, pre-commit bundle, GitHub Actions, Docker v2, whole-stack compose, Scalar, finish pipeline (boot verification, git, GitHub connect, "Start it now?"), Todo template, repo extras, feature-scoped architecture | 2.1–2.3 (pnpm), 2.5–2.7, 3.4–3.8, 3.9 (Next), 3.10–3.12 (slice), 4.4 (Express) |
| 0.5.0   | M3 Auth on the slice                                          | JWT and Better Auth (GitHub/Google OAuth) on Express + Prisma, frontend auth pages, per-user Todo                                                                                                                                                                                                             | 4.1, 4.2, 4.5 (slice)                                                          |
| 0.6.0   | M4 Breadth                                                    | Fastify, Hono, Nest parity; MySQL/SQLite/MongoDB/Redis; Drizzle, Mongoose; React + Vite, CSS Modules; Jest; yarn/bun/npm monorepos; session auth; Weather template; all presets; pino options; nightly sampling                                                                                               | rest of Phases 2–4                                                             |
| 0.7.0   | M5 Personalisation                                            | Code style / strictness knobs, remembered defaults, user presets, `add`, `mcp`                                                                                                                                                                                                                                | Phase 5                                                                        |
| 1.0.0   | M6 Hardening                                                  | Contract frozen, docs site, LTS/catalog policy, 30-day green soak                                                                                                                                                                                                                                             | Phase 6                                                                        |
| 1.1.0   | Python (uv, FastAPI, SQLAlchemy, pytest, ruff)                | post-1.0                                                                                                                                                                                                                                                                                                      |
| 1.2.0   | Go (Gin or chi, sqlc, golangci-lint), mixed-language monorepo | post-1.0                                                                                                                                                                                                                                                                                                      |

## A10. Risks

| Risk                                                                         | Mitigation                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combinatorial explosion of untested combinations                             | Tiered e2e: presets fully, every module in ≥1 combo per framework, nightly random sampling of valid points                                                                 |
| Pre-wired integration code multiplies (auth × ORM × framework = 36 variants) | Generated code is ports-and-adapters (B17.6): 1 core + 3 ORM adapters + 4 framework adapters = 8 pieces. Every pairing is a row in the integration matrix with an e2e test |
| Wiring roughly doubles template work per module (+4–6 weeks to 1.0)          | Accepted trade (D-26): wiring is the product. Contained by the layering above and by the no-sample-code rule at `wired` depth                                              |
| CI needs real Postgres/MySQL/Mongo/Redis                                     | GitHub Actions service containers; e2e runs `db:migrate`, `db:seed` and `/ready` against them                                                                              |
| Version drift breaking generated projects overnight                          | Version catalog + Renovate + nightly e2e; pin caret ranges, verify weekly                                                                                                  |
| Module contract changes forcing rewrites of every module                     | Contract v2 designed in Phase 1 with all axes in mind; migration script for contract bumps; contract versioned                                                             |
| Over-abstracting for languages we haven't built                              | Language adapter interface is defined in Phase 1 but only Node is implemented until 1.1; adapter methods are added only when a second implementation needs them            |
| Solo-maintainer bandwidth                                                    | Phases are sized so each is shippable alone; breadth modules are template-heavy, low-risk, and parallelisable to contributors                                              |
| npm supply-chain                                                             | Scoped/unique name, `npm publish --provenance`, lockfile, `npm audit` in CI, no `postinstall` in the CLI itself                                                            |
| GitHub push publishes code outward                                           | Push only after gates and boot verification; explicit confirmation; empty-remote check; never force; `.env` ignore check before the first commit (D-40)                    |
| Wizard length (~20 steps) causes drop-off                                    | Non-applicable steps skipped; presets at step 0; flags, config file and remembered defaults; Quick mode post-1.0 if drop-off shows up                                      |

---

# Part B — Architecture

## B1. Goals and constraints

Goals, in priority order: correctness of output, extensibility along the axes
in A6, testability without a filesystem, simplicity of writing a module.

Constraints: Node ≥ 22 for the CLI itself (Node 24 LTS baseline); single npm
package until external modules exist; no network access during planning (only
during install); no code execution from template content.

## B2. Core concepts

```
StackSpec  ──resolve──▶  ResolvedStack  ──plan──▶  GenerationPlan  ──apply──▶  Project on disk
(user intent)            (modules, targets,        (pure data: files,          (fs writes, installs,
                          versions, env)            manifests, commands)        post steps, summary)
```

| Concept                     | Definition                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **StackSpec**               | Declarative user intent: project name, layout, package manager, list of module ids with options, per-target overrides. Serialisable JSON. Produced by the wizard, a preset, a config file, or an agent. |
| **Module**                  | A unit of capability (framework, ORM, middleware, CI…). Declares metadata, constraints, dependencies, files, slot contributions, env vars, and optional hooks. Never touches the filesystem directly.   |
| **Category**                | Closed enum grouping modules; some categories are single-select per target.                                                                                                                             |
| **Capability (`provides`)** | Abstract tag a module satisfies (`auth`, `db:postgres`, `http-framework`). Constraints resolve against tags as well as ids.                                                                             |
| **Target**                  | Where files and dependencies land: `root`, or a workspace package (`apps/api`, `apps/web`, `packages/shared`). Single layout = one implicit target at root.                                             |
| **Language adapter**        | Per-language implementation of manifest merging, install/exec commands, lockfiles, and run scripts.                                                                                                     |
| **Package-manager adapter** | Per-PM command shapes, workspace config, hook commands, Docker install lines.                                                                                                                           |
| **Slot**                    | A named code injection point a framework template exposes (`app.imports`, `app.middleware`, `app.routes`). Other modules contribute typed fragments; the template renders them in dependency order.     |
| **GenerationPlan**          | The complete, ordered, side-effect-free description of what will be written and run. Snapshot-testable. `--dry-run` prints it.                                                                          |
| **Manifest**                | `.devstack/stack.json` written into the project: the StackSpec plus CLI version and module versions. Enables replay and `add`.                                                                          |

## B3. Pipeline

```
bin/cli.ts
  └─ commands/init.ts | add.ts | plan.ts | presets.ts | mcp.ts (later)
       └─ preflight: doctor checks (node, PM, git identity, docker when compose)   (D-44)
       └─ intake:   wizard | preset | config file | flags  → StackSpec (validated by Zod)
       └─ resolve:  registry + StackSpec → ResolvedStack
             ├─ expand requires/requiresAny/provides/enhancedBy
             ├─ topological order
             ├─ validate: categories, conflicts, per-target single-select, language compatibility
             └─ attach versions from catalog
       └─ plan:     ResolvedStack → GenerationPlan
             ├─ VirtualFileSystem: render templates, apply slot fragments, merge JSON/YAML, append
             ├─ manifests per target (package.json / pyproject.toml / go.mod) via language adapter
             ├─ env: collect env declarations → .env.example + env schema input
             ├─ commands: git init, install, exec (prisma generate…), hooks — as data
             └─ conflicts with existing files → recorded, not resolved yet
       └─ apply:    GenerationPlan → disk
             ├─ conflict policy (prompt / overwrite / skip / abort; --yes never means overwrite-existing)
             ├─ stage every file in a fresh temp dir, then copy in; no deletes, failures report what was written (D-54)
             ├─ run commands with streaming output, timeouts, clear failures
             └─ write .devstack/stack.json
       └─ verify:   install gates (lint, typecheck, test) + boot check (/health, /ready)   (D-44)
       └─ finish:   git init → .env ignore check → initial commit → GitHub push, opt-in   (B18)
       └─ summarise: next steps, env vars to fill, warnings (permissive defaults), docs links
       └─ start:    opt-in "Start it now?" → db:up + dev + open browser
```

The resolve and plan stages are pure functions of (registry, spec, catalog).
That is the property that makes everything else (dry-run, replay, tests, MCP)
cheap.

## B4. Module contract v2

```ts
export interface DevstackModule {
  // identity
  id: string // 'framework-fastify'; unique, kebab-case, category-prefixed
  version: string // module version, semver; bumps when files/contract change
  category: ModuleCategory
  language: LanguageId // 'node' | 'python' | 'go'
  title: string // shown in prompts
  description: string
  docsUrl?: string

  // constraints (ids or capability tags)
  provides?: string[] // ['http-framework', 'auth']
  requires?: string[] // all must be present
  requiresAny?: string[] // at least one must be present
  conflictsWith?: string[]
  enhancedBy?: string[] // soft; drives recommendations and template branching
  singleSelect?: boolean // override category default

  // placement
  target?: TargetRole // 'root' | 'backend' | 'frontend' | 'shared' (default: backend)

  // dependencies — versions come from the catalog, not literals
  dependencies?: CatalogRef[] // ['fastify', '@fastify/cors']
  devDependencies?: CatalogRef[]
  manifest?: ManifestFragment // scripts, engines, etc. merged by the language adapter

  // files and code — every FileSpec and SlotContribution may carry `when` and `depth`
  files?: FileSpec[] // { from: 'files/src/app.ts.eta', to: 'src/app.ts', when?: Condition, depth?: Depth }
  slots?: SlotContribution[] // { slot: 'app.middleware', code: '...', order?: number, imports?: [...], when?, depth? }
  exposesSlots?: string[] // frameworks declare the slots their templates render
  templateVariables?: (ctx: TemplateContext) => Record<string, unknown>

  // configuration
  options?: ZodSchema // per-module options (e.g. rate-limit window); validated in StackSpec
  env?: EnvDeclaration[] // { name, description, example?, required, secret? }

  // lifecycle (data, not side effects, where possible)
  commands?: CommandSpec[] // { phase: 'postInstall', run: ['prisma','generate'], when: 'installed' }
  hooks?: {
    afterResolve?: (stack: ResolvedStack) => Diagnostic[] // custom validation
    beforeApply?: (plan: GenerationPlan) => GenerationPlan // rare; must be pure
  }
}
```

```ts
type Depth = 'bare' | 'wired' // a contribution appears at its depth and above; default 'wired'

type Condition =
  // evaluated against the ResolvedStack at plan time
  | { has: string } // module id or capability tag is selected (same target)
  | { hasAnywhere: string } // ... in any target (e.g. frontend checks for a backend)
  | { framework: string } // this target's framework id
  | { option: string; equals: unknown } // this module's option value
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
```

Conditional contributions are how **integration glue** is expressed: the
Prisma module ships `src/db/client.ts` unconditionally, a Fastify plugin
`when: { framework: 'framework-fastify' }`, and a user repository
`when: { has: 'auth' }`. There are no separate "glue modules"; glue lives
with the module that owns the capability being adapted (ORM owns
repositories, framework owns HTTP adapters, auth owns the service core).

Rules:

- A module never calls `fs`, `execa` or prompts. Files go through `files`,
  code through `slots`, processes through `commands`.
- Every pairing a module supports via `when` is a row in the integration
  matrix (`tests/e2e/integrations.json`) with at least one e2e combination.
- Versions are catalog references. A literal version string in a module is a
  lint error (custom ESLint rule in the CLI repo).
- `id` is stable forever; renames go through an alias table.
- Every module ships with: `index.ts`, `files/`, `module.test.ts` (resolves
  and plans in at least one valid combination), and is added to the e2e matrix.

### Categories and single-select rules

| Category                                                                                                    | Single-select scope             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `language`                                                                                                  | per target                      |
| `package-manager`                                                                                           | per repo                        |
| `layout`                                                                                                    | per repo                        |
| `template`                                                                                                  | per repo                        |
| `framework`, `styling`                                                                                      | per target                      |
| `api-style`                                                                                                 | per backend target              |
| `database`                                                                                                  | primary DB single; caches multi |
| `orm`                                                                                                       | per backend target              |
| `auth`                                                                                                      | per backend target              |
| `architecture`                                                                                              | per target                      |
| `env`                                                                                                       | per target                      |
| `testing`, `quality`, `middleware`, `security`, `devops`, `observability`, `api-docs`, `repo`, `ai`, `misc` | multi                           |

The enum is closed. Adding a category is a §7 decision.

## B5. Resolution engine

Input: registry, StackSpec. Output: ResolvedStack or a list of diagnostics
(never a single thrown string; the wizard needs all errors at once).

Algorithm:

1. Expand: for each selected module, pull in `requires` transitively. Do not
   auto-select `requiresAny` — report it, and let the wizard offer choices.
2. Tag index: build `capability → modules` from `provides` over the selected
   set.
3. Check `requires`, `requiresAny`, `conflictsWith` against ids ∪ tags.
4. Check single-select per scope (category × target).
5. Check language compatibility: a module's `language` must match its
   target's language; the target language is fixed by the `language-*`
   module assigned to it.
6. Check slot contributions reference slots that some selected module
   `exposesSlots`.
7. Run module `afterResolve` hooks.
8. Topological order by `requires` (ties broken by category order then id) —
   this is also the order slot fragments render in unless `order` overrides.
9. Attach catalog versions; a missing catalog entry is a resolution error.

Diagnostics carry `severity`, `moduleId`, `message`, and `fix?` (e.g. "select
one of: framework-express, framework-fastify") so the wizard and MCP mode can
act on them.

## B6. Files, templates, slots

**Virtual file system.** Planning builds an in-memory tree
(`Map<path, FileEntry>`) where `FileEntry = { content, mode, strategy }`.
Strategies: `create` (fail on conflict unless policy says otherwise),
`overwrite`, `json-merge` (deep merge with array-union), `yaml-merge`,
`append`, `skip-if-exists`. Existing on-disk files are only consulted at apply
time; the plan records intended conflicts.

**Templating.** Engine: **Eta** (small, fast, TypeScript, no runtime eval of
user data). Only files ending in `.eta` are rendered; the suffix is stripped.
Everything else is copied byte-for-byte. Path segments may contain
`__token__` placeholders (`src/__projectNameKebab__/`). Template context =
project variables (`projectName` in kebab/pascal/camel, `packageManager`,
`language`, `year`) + selected module ids + module options + slot output.
Unknown tokens are a planning error, not a silent blank.

**Slots.** A framework template declares slots; contributors add fragments.

```ts
// framework-fastify exposesSlots: ['app.imports','app.plugins','app.routes','app.shutdown']
// security-helmet contributes:
slots: [
  { slot: 'app.imports', code: `import helmet from '@fastify/helmet'` },
  { slot: 'app.plugins', code: `await app.register(helmet)`, order: 10 }
]
```

The renderer deduplicates imports, orders fragments, and emits them into the
template at `<%~ it.slots['app.plugins'] %>`. There is no runtime discovery of
middleware in generated code: what you selected is what is imported, and a
missing dependency is a compile error, not a silent no-op. Framework-specific
fragment shapes (Express `app.use`, Fastify `register`, Nest module imports)
are handled by contributing per-framework fragments keyed by the framework's
id: `slots: [{ slot: 'app.middleware', for: 'framework-express', … }]`.

## B7. Language and package-manager adapters

```ts
interface LanguageAdapter {
  id: LanguageId
  manifest: {
    fileName: string // package.json | pyproject.toml | go.mod
    create(ctx): ManifestDocument
    merge(doc, fragment, deps: ResolvedDependency[]): ManifestDocument
    serialize(doc): string
  }
  defaultPackageManager: PackageManagerId
  packageManagers: PackageManagerId[]
  scripts: { build: string; dev: string; test: string; lint: string } // canonical names → PM-specific run
  dockerBase: { image: string; installLine: (pm) => string[] }
}

interface PackageManagerAdapter {
  id: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'uv' | 'go'
  lockfile: string
  install(): string[] // ['pnpm','install','--frozen-lockfile']
  add(deps, { dev }): string[]
  exec(bin, args): string[] // ['pnpm','exec',bin,...]
  run(script): string[]
  hookCommand(bin): string // for husky/lefthook files
  workspace: {
    configFiles(targets): FileSpec[]
    rootManifestFields(targets): object
  }
  ciSetup: { actionsSteps(): object[] } // setup-node + cache config
}
```

Node adapter ships in Phase 1 by refactoring existing behaviour. Python (uv,
`pyproject.toml`, `uv.lock`, `uv run`) and Go (`go.mod`, `go.work`,
`go run`) ship post-1.0 (1.1 and 1.2, D-21). The adapter interface may only grow when a second
implementation needs a method.

## B8. Layouts and targets

| Layout     | Targets                                                 | Root files                                                                                                                                             |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `single`   | one implicit target at `/`                              | manifest, tool configs                                                                                                                                 |
| `monorepo` | `apps/<name>` per app, `packages/<name>` per shared lib | root manifest with workspaces, `pnpm-workspace.yaml` / `turbo.json` / `bunfig` / `.yarnrc.yml`, shared `tsconfig.base.json`, root lint/format, root CI |

Decision (§7 D-03): single layout **is** a workspace with one target whose
path is `/`. One code path; the monorepo adapters add root files and
per-target paths.

Target naming: `backend` role → `apps/api`, `frontend` → `apps/web`, `shared`
→ `packages/shared`, overridable in StackSpec. Mixed-language monorepos
(post-1.0) give each target its own language adapter; root tooling is the
primary language's (Turborepo can orchestrate `uv run` / `go build` tasks via
`turbo.json`).

## B9. Versions catalog

`src/catalog/<language>.ts`: a single typed map `name → { version, note? }`
per ecosystem. Modules reference names only. The catalog is:

- validated in CI against the registry (every referenced name exists),
- bumped by Renovate PRs that run the full e2e matrix,
- exported in `--print-plan` so users see what they will get.

Peer/type pairings (`express` ↔ `@types/express` major) are encoded in the
catalog as `pairs` so the resolver adds the correct types package when a
module requires the types.

## B10. Environment variables

Modules declare `env`. Planning aggregates them into:

- `.env.example` (grouped by module, comments from `description`, secrets
  marked),
- input for the selected `env-*` module (Zod schema / pydantic-settings /
  envconfig), which generates the runtime validator,
- the post-generation summary ("Fill in: DATABASE_URL, GITHUB_CLIENT_ID…").

Permissive-default warnings (CORS allowlist empty, rate limit off) are
declared by the module as `env[].warnIfUnset` and surfaced by the summary and
by a startup log line in the generated code.

## B11. CLI surface

```
devstack init [name] [--name <name>] [--preset <p>] [--config <file>] [--yes] [--advanced]
              [--app backend|frontend|fullstack] [--backend <fw>] [--frontend <fw>]
              [--styling tailwind|css-modules|none] [--db <engine>] [--redis] [--orm <orm>]
              [--auth none|jwt|session|better-auth] [--oauth github,google]
              [--pm npm|pnpm|yarn|bun] [--arch flat|mvc|feature|clean]
              [--template none|todo|weather] [--hooks|--no-hooks] [--test vitest|jest|none]
              [--docker|--no-docker] [--compose|--no-compose] [--api-docs|--no-api-docs]
              [--middleware cors,helmet,rate-limit,logging,compression] [--ci github|none]
              [--extras agents,vscode,github] [--github <repo-url>] [--start]
              [--layout single|monorepo] [--depth bare|wired] [--in-place]
              [--dry-run] [--print-plan [json]] [--skip-install] [--skip-git]
              [--verbose] [--no-color]
devstack add <module...> [--dry-run]            # in a DevStack project
devstack plan [--config <file>]                  # resolve + plan, no writes
devstack presets list|show|save <name>
devstack modules list [--category] [--language]
devstack doctor                                  # env checks: node/pnpm/git/docker versions
devstack mcp                                     # Phase 5
```

`npm create <package-name>` / `npx <package-name>` alias to `init`. How post-init commands
(`add`, `plan`, …) are invoked is Q-12.

Exit codes: 0 ok, 1 generation failed after writes (project may be partial;
summary says what ran), 2 invalid input/resolution (nothing written), 3 user
abort.

## B12. Config file and manifest

```jsonc
// stack.json (input) — also written to .devstack/stack.json (with `generatedBy`)
{
  "$schema": "https://devstack.dev/schema/stack.v1.json",
  "name": "acme-api",
  "layout": "monorepo",
  "packageManager": "pnpm",
  "targets": {
    "api": { "role": "backend", "language": "node" },
    "web": { "role": "frontend", "language": "node" }
  },
  "modules": [
    "framework-fastify",
    "orm-drizzle",
    "database-postgres",
    {
      "id": "rate-limit",
      "target": "api",
      "options": { "windowMs": 60000, "limit": 200 }
    },
    "framework-nextjs",
    "shared-types",
    "testing-vitest",
    "quality-eslint",
    "quality-prettier",
    "devops-github-actions",
    "devops-docker"
  ]
}
```

Schema is versioned; the CLI migrates older manifests forward.

## B13. Testing strategy

| Layer                     | What                                                                                                                                                                                                                 | Tooling                                                                                             | Runs                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Unit                      | resolver, catalog, template renderer, slot merger, adapters                                                                                                                                                          | Vitest, no fs                                                                                       | every PR                                      |
| Plan snapshots            | `GenerationPlan` for every preset and a curated combo list, serialised and snapshotted                                                                                                                               | Vitest snapshots                                                                                    | every PR                                      |
| Module tests              | each module resolves + plans in ≥1 combination; slot fragments compile in isolation                                                                                                                                  | Vitest                                                                                              | every PR                                      |
| e2e matrix                | generate → install → lint → format → typecheck → `db:migrate` + `db:seed` → test → build → smoke (`/health`, `/ready` against a real DB, expected security headers; fullstack: web's `/api/ready` through the proxy) | GitHub Actions matrix with service containers (Postgres, MySQL, Mongo, Redis), per PM, per Node LTS | every PR for presets; nightly for full matrix |
| Depth and template matrix | each preset at `bare` and `wired`, and with each app template; `bare` must still pass gates, templates must pass their generated tests                                                                               | same harness                                                                                        | every PR for presets                          |
| Integration matrix        | every `when` pairing declared by any module appears in ≥1 e2e combination                                                                                                                                            | coverage check script                                                                               | every PR                                      |
| Finish pipeline           | boot verification; git init + initial commit with hooks; push to a local bare remote; non-empty remote refused; invalid URLs rejected                                                                                | e2e harness                                                                                         | every PR                                      |
| Nightly sampling          | N random valid StackSpecs from the resolver's space                                                                                                                                                                  | script + matrix                                                                                     | nightly                                       |
| Contract lint             | modules: no literal versions, no fs/execa imports, files exist, slots exist                                                                                                                                          | custom ESLint rules + test                                                                          | every PR                                      |

The e2e harness (`tests/e2e/harness.ts`) is written in Phase 0 and every
module PR adds its combination to `tests/e2e/matrix.json`.

## B14. Security

- **Supply chain:** unique scoped package name; `npm publish --provenance`
  from GitHub Actions only; lockfile committed; `npm audit` gate; no
  `postinstall` script in the CLI; Renovate with e2e gate.
- **Input:** project name validated against npm rules plus `..`/absolute-path
  rejection; target paths resolved and checked to be inside project dir;
  config file validated by Zod with unknown keys rejected.
- **Templates:** Eta with autoescape off is acceptable because all inputs are
  developer-controlled strings, but no template may evaluate user strings as
  code; template context is data only.
- **Generated projects:** security middleware on in presets; Docker
  multi-stage, non-root, `--frozen-lockfile`; secrets never in files —
  `.env` gitignored, `.env.example` only; CORS/origin permissive-default
  warnings; rate limit on by default for HTTP frameworks.
- **GitHub connect:** URL validated against the two accepted shapes and passed as an
  argument; empty-remote check; explicit confirmation; never force-push; credentials are
  the user's own git setup and never read or stored; `.env` ignore check before the first
  commit; secret scanning in the pre-commit bundle (D-40, D-45).
- **Commands:** allow-listed binaries per adapter (`git`, PM binary, PM exec
  of catalog packages); never shell-interpolated.
- **Third-party modules:** out of scope; when they arrive they run in the
  same process, so signing + review is the gate, not sandboxing.

## B15. Observability and errors (the CLI itself)

- Structured logger with levels; `--verbose` enables debug; `--json` on
  `plan` for machine consumers.
- Error taxonomy: `InputError` (exit 2), `ResolutionError` with diagnostics
  (exit 2), `ApplyError` with the step and the command output (exit 1),
  `Aborted` (exit 3). Every error has an actionable message.
- No telemetry by default. If added later: opt-in flag, documented payload,
  no project names.

## B16. Repository layout of the CLI

```
bin/cli.ts
src/
  commands/            init, add, plan, presets, modules, doctor
  intake/              wizard (basic/advanced), preset loader, config loader, flag mapping
  core/
    registry.ts        loads builtin modules, alias table
    resolver/          expand, validate, order, diagnostics
    planner/           vfs, templates (eta), slots, manifests, env, commands
    apply/             conflict policy, staging writer, command runner, manifest writer
    finish/            boot verification, git init + commit, GitHub connect, start-now
    summary.ts
  adapters/
    language/          node.ts, python.ts, go.ts
    package-manager/   npm.ts, pnpm.ts, yarn.ts, bun.ts, uv.ts, go.ts
    layout/            single.ts, monorepo.ts (+ turborepo, workspaces variants)
  catalog/             node.ts, python.ts, go.ts, pairs.ts
  modules/<id>/        index.ts, files/, module.test.ts
  presets/             builtin presets (json)
  types/               spec.ts, module.ts, plan.ts, diagnostics.ts
  utils/
tests/
  unit/  snapshots/  e2e/ (harness.ts, matrix.json)
docs/
  adr/                 one file per §7 decision once implemented
  modules/             generated module reference
```

Toolchain for the CLI: ESM, `tsup` bundle, `@clack/prompts` behind a
`Prompter` interface (swappable, mockable), `commander`, `execa` 9, `zod` 4,
`eta`, Vitest, ESLint 10 flat config, Prettier, Changesets for releases.
Files ≤ 400 lines; functions ≤ 50 lines.

## B17. Generated project architecture (the golden path)

This section specifies what DevStack writes. It is the contract between
module authors and users: if a module is selected at a given depth, the files
and behaviour below exist and work. Paths are for a backend target; in a
monorepo they are relative to `apps/<name>/`.

### B17.1 First-run experience

```
pnpm db:up     # docker compose up -d <data services> (DB/Redis with healthchecks)
pnpm dev       # single: the API. monorepo: turbo runs api (:3001) and web (:3000)

# or everything in containers:
docker compose up   # data services → api → web, ordered by healthchecks (D-41)
```

- Backend-only: `GET /ready` returns `{ status: "ok", checks: { db: "ok" } }`.
- Fullstack: `localhost:3000` renders a status page, **"API ✓ connected · DB ✓
  connected"**, fetched from `/api/ready` through the dev proxy. The e2e
  harness asserts exactly this.
- `db:up` is a separate step on purpose: starting Docker containers
  implicitly from `dev` surprises people. The post-generation summary prints
  both commands.

### B17.2 Backend baseline (`wired`, every framework)

```
src/
  index.ts                 entry: load env → createApp(deps) → listen → graceful shutdown
  app.ts                   createApp(deps): framework instance, middleware, routes, error handler
  config/env.ts            Zod schema composed from all modules' `env` declarations; fails fast listing missing vars
  lib/logger.ts            pino; child logger per request with request id
  lib/errors.ts            AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError
  http/
    middlewares/           request-id, error-handler, not-found, + selected security middleware (explicit imports)
    routes/
      index.ts             route registry (slot `app.routes`)
      health.ts            GET /health (liveness), GET /ready (runs each registered readiness check)
    validation.ts          validate(schema) helper: Zod (Express/Fastify/Hono) or class-validator pipe (Nest)
  modules/                 domain code (empty with `.gitkeep` unless auth or a template is selected)
tests/
  health.test.ts           Supertest against createApp() with no listen; green on day one
.env / .env.example        see B17.7
README.md                  generated from the ResolvedStack: stack, scripts, env vars, structure, next steps
```

Behaviour guaranteed at `wired`:

- **Error envelope:** every error response is
  `{ error: { code, message, requestId, details? } }`. Stack traces never leave
  the process in production.
- **Graceful shutdown:** SIGTERM/SIGINT → stop accepting connections → drain
  (bounded timeout, default 10s) → run registered disposers (DB, Redis) →
  exit 0. Disposers are registered by modules through the `app.shutdown` slot.
- **Readiness:** modules register checks through the `app.readiness` slot;
  `/ready` returns 503 with per-check status if any fail.
- **Security middleware** (if selected) is imported explicitly, in a fixed
  order: request-id → logger → helmet → CORS → origin-check → rate-limit →
  body parsing → routes → not-found → error handler.
- **Nest** gets the same guarantees with Nest idioms: `ConfigModule` with the
  Zod schema, a global exception filter producing the same envelope,
  `enableShutdownHooks()`, a `HealthModule`.

### B17.3 Database wiring (`wired`)

Owned by the ORM module, with database-specific details from the `database-*`
module.

| Piece          | Prisma + Postgres (reference)                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Client         | `src/db/client.ts`: singleton, `connect()` at startup with a clear error if unreachable                                 |
| Shutdown       | disposer registered in `app.shutdown` → `$disconnect()`                                                                 |
| Readiness      | check registered in `app.readiness` → `SELECT 1`                                                                        |
| Schema         | `prisma/schema.prisma` with the datasource and generator configured, no models at `wired` unless auth adds `User`       |
| Migrations     | initial migration generated at plan time so `db:migrate` works immediately                                              |
| Seed           | `prisma/seed.ts` (empty body at `wired`, sample data with a template)                                                   |
| Scripts        | `db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset`, `db:studio` (ORM-appropriate equivalents for Drizzle/Mongoose) |
| Compose        | service with healthcheck, named volume, `api` service uses `depends_on: condition: service_healthy`                     |
| Env            | `DATABASE_URL` with a local default in `.env`, described in `.env.example`                                              |
| Framework glue | Fastify: plugin decorating `app.db`; Nest: `DatabaseModule` provider; Express/Hono: passed via `createApp(deps)`        |

Drizzle and Mongoose provide the same pieces with their own idioms
(`drizzle-kit` migrations; Mongoose connection with `serverSelectionTimeoutMS`).
`cache-redis` follows the same pattern: client, disposer, readiness check,
compose service, `REDIS_URL`.

### B17.4 Fullstack wiring (`wired`)

| Piece               | Behaviour                                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev proxy           | Next.js: `rewrites()` in `next.config.ts` maps `/api/:path*` to `${API_URL}/:path*`. Vite: `server.proxy['/api']` with path rewrite. The browser only ever talks to the web origin in development, so CORS does not arise.                                                                                            |
| Production topology | **Split origin** by default (D-29): web and API deploy separately. The frontend calls `NEXT_PUBLIC_API_URL` / `VITE_API_URL`; the API's CORS allowlist is `WEB_ORIGIN` (never `*`); cookies, if auth uses them, are configured `SameSite=None; Secure` in production only. Same-origin via reverse proxy is post-1.0. |
| Ports               | one source of truth, `devstack.ports` in the root manifest, read by both apps' env defaults: web 3000, api 3001 (D-30)                                                                                                                                                                                                |
| Shared package      | `packages/shared`: response/error envelope types, and `apiClient` — a small typed `fetch` wrapper that resolves the base URL (proxy path in dev, env URL in prod), parses the error envelope into a typed error, and forwards credentials when auth is selected                                                       |
| Status page         | web home page renders API and DB status from `/api/ready`; moves to `/status` when a template's UI takes the home page                                                                                                                                                                                                |
| Styling             | Tailwind or CSS Modules configured for the frontend framework; the status page and auth pages use it (D-42)                                                                                                                                                                                                           |
| Scripts             | root `dev`, `build`, `lint`, `test`, `typecheck` via Turborepo; `dev` is a persistent task running both apps                                                                                                                                                                                                          |

### B17.5 Auth wiring (`wired`, when an auth module is selected)

- `User` model added to the selected ORM's schema; initial migration includes it.
- `src/modules/auth/`: `auth.service.ts` (register, login, verify),
  `password.ts` (argon2), `user.repository.ts` (interface).
- ORM adapter: `src/db/repositories/user.repository.<orm>.ts`.
- Framework adapter: `src/http/routes/auth.ts` (`POST /auth/register`,
  `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`) and a
  `requireAuth` middleware/guard.
- JWT: short-lived access token, `JWT_SECRET` required (generated into `.env`
  for local dev only, flagged in the summary). Session: Redis store,
  httpOnly cookie. Better Auth: its handler mounted, adapter wired to the ORM,
  GitHub/Google social providers enabled when selected, callback URLs in the
  README, client id/secret blank in `.env` and listed in the summary (D-38).
- Tests: register → login → `/auth/me` → logout, against the real test DB.
- Frontend (D-43): `apiClient` sends credentials; login, register and logout
  pages, one OAuth button per selected provider, and a protected-route helper
  are generated at `wired`.

### B17.6 Layering rule (ports and adapters)

Generated code is layered so that integrations compose additively:

```
src/modules/<domain>/        domain services + repository interfaces   (framework- and ORM-agnostic, written once)
src/db/repositories/         one adapter per ORM                        (implements the interfaces)
src/http/routes/             one adapter per framework                  (translates HTTP ↔ service calls)
src/index.ts / app.ts        composition root                           (wires adapters into services)
```

Auth across 3 ORMs × 4 frameworks is therefore one core, three repository
adapters and four route adapters: 8 maintained pieces, not 36. The same shape
applies to the app templates and to any future domain module. Architecture
layouts (`arch-flat`, `arch-mvc`, `arch-feature`, `arch-clean`) change folder
naming and grouping around this rule; they do not break it. `arch-flat`
collapses the folders but keeps the interfaces; `arch-feature` groups each
domain's service, repository interface, routes and tests under
`src/features/<domain>/`.

### B17.7 Environment files

- `.env.example` is committed: every variable from every selected module,
  grouped by module, with descriptions, required/optional, and secret markers.
- `.env` is generated **for local development only** (D-31): non-secret
  values get working local defaults (`DATABASE_URL` pointing at the compose
  service, ports); secrets used purely locally (`JWT_SECRET`) get a random
  value generated at plan time; third-party secrets (OAuth, Sentry DSN) are
  left blank and listed in the summary. `.env` is always gitignored.
- `config/env.ts` validates at startup and prints every missing or invalid
  variable at once.

### B17.8 App templates: Todo and Weather (D-39)

Applies only with `--template todo | weather` (wizard #10). Built on B17.6. Each template is a
module (`template-todo`, `template-weather`) whose files and slots carry `when` conditions per
ORM, framework and frontend. Everything a template adds lives in its own domain folder, adapters
and pages, so it can be deleted in one step; the README says how.

**Todo** (requires a database)

| Layer      | Contents                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema     | `Todo { id, title, completed, dueAt?, createdAt, updatedAt, ownerId? }`; `ownerId` → `User` when auth is selected                                                                       |
| Domain     | `todos.service.ts` (list with `completed`/`dueBefore` filters and cursor pagination, get, create, update, toggle, delete; ownership enforced with auth), `todo.repository.ts` interface |
| Adapters   | ORM repository; routes `GET/POST /todos`, `GET/PATCH/DELETE /todos/:id`, behind `requireAuth` when auth is selected                                                                     |
| Validation | Zod schemas (DTOs on Nest), shared with the frontend via `packages/shared` in fullstack                                                                                                 |
| Seed       | a few todos, plus a demo user when auth is selected (credentials printed in the summary)                                                                                                |
| Tests      | service unit tests with an in-memory repository; route integration tests against the test DB; ownership test (user A cannot read or change user B's todo)                               |
| Frontend   | list with filters, create, edit, toggle, delete via `apiClient`                                                                                                                         |

**Weather** (no database required)

| Layer    | Contents                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain   | `weather.service.ts` (current conditions and forecast by city), `weather.provider.ts` interface                                                                                                                  |
| Adapters | provider adapter for a keyless public API (Open-Meteo geocoding + forecast) so the template runs without signup, its usage terms noted in the README; routes `GET /weather?city=`, `GET /weather/forecast?city=` |
| Caching  | in-memory TTL cache; Redis when `cache-redis` is selected                                                                                                                                                        |
| Errors   | upstream timeout or failure → error envelope `UPSTREAM_UNAVAILABLE` (502); `city` validated                                                                                                                      |
| Tests    | service tests with a fake provider; route tests; cache hit/miss test; no network access in tests                                                                                                                 |
| Frontend | city search and forecast view via `apiClient`                                                                                                                                                                    |

### B17.9 Repository files

Always generated: ESLint flat config, Prettier config, `.editorconfig`, `tsconfig`, `.gitignore`
(`.env`, dependencies, build output, coverage), `.gitkeep` in every folder the chosen
architecture defines that has no files, README, `.devstack/stack.json`.

Pre-commit bundle (wizard #11): Husky runs lint-staged (ESLint + Prettier on staged files),
secret scanning on staged changes (tool per Q-13), and commitlint on the commit message.

Repo extras (wizard #18, D-45):

| Extra                | Files                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI assistant context | `AGENTS.md` generated from the ResolvedStack: stack, commands, folder map, conventions, where to add a feature. `CLAUDE.md` imports it (`@AGENTS.md`)                             |
| VS Code setup        | `.vscode/settings.json` (format on save, ESLint fix on save), `extensions.json`, `launch.json` for debugging the API                                                              |
| GitHub hygiene       | `.github/dependabot.yml` (package ecosystem + GitHub Actions), PR template, bug and feature issue templates, `CODEOWNERS` (owner from the repo URL, else a commented placeholder) |

## B18. Finish pipeline

User-facing behaviour is A0.4 and A0.5; this section adds the mechanics.

- **Boot verification:** after `build`, start each app's production entry with `.env` and a free
  port, poll `/health` for up to 30 s (web: `/health` on Next, `/` on `vite preview`), call
  `/ready` only when data services are running, then SIGTERM and assert exit 0 within the
  shutdown timeout. This also exercises graceful shutdown. With `--skip-install` the project is
  "Not verified" and the GitHub push is skipped with a retry hint.
- **Git:** `git init -b main`, check `git check-ignore .env`, `git add -A`, commit with hooks.
  Skipped entirely with `--skip-git`.
- **GitHub:** validate URL → `git ls-remote <url>` (empty output required) → confirm →
  `git remote add origin <url>` → `git push -u origin main`. All via the command runner's
  allow-list with argv arrays.
- **Exit codes:** push failure and skipped verification are warnings (exit 0); a failed gate or
  failed boot check is exit 1 with the failing step and its output.

---

# Part C — Execution plan

Each phase lists tasks, exit gate, and rough effort for one engineer.
Effort: S ≤ 1 day, M ≤ 3 days, L ≤ 1 week, XL > 1 week.

**Execution order (D-47).** Phases group tasks by topic; they are not executed strictly in
number order. Phases 0 and 1 run in order. Then the vertical slice (A9 0.4.0) pulls the slice
subset of Phases 2–4, auth on the slice follows, and the remaining tasks of Phases 2–4 form the
breadth milestone. Each milestone's gate is its phases' exit gates restricted to what it ships.

Within Phase 0 the order is 0.11 → 0.2 → 0.9 → 0.4 → 0.5 + 0.6 → 0.3 → 0.7 + 0.8 + 0.10 → 0.1.
Task 0.3 builds slots once, on the Eta planner (not a throwaway minimal renderer), so it follows
0.5. The e2e job stays non-blocking; making it required is deferred with the other workflow work (D-52), so the Phase 0 gate is checked by running the harness locally.

## Phase 0 — Stabilise and lay the foundation (target: v0.2.0)

Goal: the existing 16 modules produce projects that pass their own gates; the
pipeline becomes deterministic; the package can be published under a name we
own.

| #    | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Effort |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0.1  | Rename package (§8 Q-01). Update README, bin name, CI. _(2026-09-30: the release workflow with provenance is deferred by D-52; the rename and a local `npm publish --dry-run` stay in Phase 0.)_ _(Landed 2026-09-30: package and bin are `create-devstack-app` (still free on npm that day); the CLI, generated package description, README and manifest take the name from package.json; `prepack` rebuilds `dist`; Changesets 3 is set up with a pending minor changeset for 0.2.0; the README describes what exists today. `npm publish --dry-run` is clean: 37 files, 26 kB, no tests or sources.)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S      |
| 0.2  | e2e harness: generate preset → install → lint/format/typecheck/build → smoke `/health` + header assertions; GitHub Actions matrix (npm, pnpm; Node 24, 26). Run for `backend` preset and a Nest combo. **Expected to fail on first run — that is the point.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | M      |
| 0.3  | Replace runtime `require()` in Express/Nest templates with slot-based generation (minimal slot renderer; full engine in Phase 1). Fix `.lintstagedrc.json` formatting, remove stray `src/index.ts` on framework selection, add `@types/express` pairing for Nest middleware. Server entry handles SIGTERM/SIGINT (close the server, exit 0) so the harness boot check passes; the full disposer model is 1.10. _(Found by the e2e harness, 2026-09-30.)_ Generated projects switch to ESM here, together with Nest 12 (ESM-only) and Prisma 7 (`prisma.config.ts`, `prisma-client` generator with `output`, `@prisma/adapter-pg`, explicit `dotenv`) (D-53). _(Split 2026-09-30. Part 1 landed: Eta rendering of `.eta` templates with a strict context, slots with ordered, de-duplicated fragments validated against `exposesSlots`, explicit middleware imports in Express and Nest, graceful SIGTERM/SIGINT shutdown with exit 0 (D-55); backend preset and a Nest combination pass lint, format, typecheck, build and boot on npm and pnpm. Part 2 landed the same day: generated projects are ESM (`"type": "module"`, `.js` relative imports, guarded by a test) with Nest 12 and Prisma 7 (D-56); the backend preset passes every e2e check on npm and pnpm, and a Nest 12 + Prisma 7 combination was verified the same way by hand.)_ | M      |
| 0.4  | Version catalog (`src/catalog/node.ts`); modules reference names; contract lint rule for literal versions. Bump to Node 24 engines, `node:24-alpine`, ESLint 10 flat config, Prisma 7, `express` ↔ `@types/express` matched majors. Nest dev script that preserves decorator metadata (Q-03). Catalog marks packages that run install scripts (`prisma`, `@prisma/engines`, `@prisma/client`, `esbuild`); for pnpm the generated project allowlists exactly those, because pnpm ≥ 11 fails install on unapproved build scripts (`ERR_PNPM_IGNORED_BUILDS`). _(Found by the e2e harness, 2026-09-30.)_ _(Landed 2026-09-30: `src/catalog/node.ts` + `pairs.ts`; modules list catalog names only, enforced by a contract test; Express 5, ESLint 10 flat config (`eslint.config.mjs`), TypeScript 6.0 with `NodeNext`, `@types/node` 24, Node 24 engines, `node:24-alpine`, Nest dev via `@swc-node/register`; pnpm projects get `pnpm-workspace.yaml` with `allowBuilds` (pnpm 12) and `onlyBuiltDependencies` (pnpm 10). Nest 12 and Prisma 7 moved to 0.3, see D-53.)_                                                                                                                                                                                                                                                                        | M      |
| 0.5  | GenerationPlan as data; `--dry-run` and `--print-plan [json]`; apply stage writes via staging dir; conflict policy (`--yes` never overwrites existing files; new `--force`). _(Landed 2026-09-30: `src/core/planner` builds the plan (files + commands as data) and formats every file with the project's Prettier config (D-48); `src/core/apply` classifies files, applies the conflict policy, stages into a fresh temp dir and copies in, with no automatic rollback (D-54); module post-install hooks became declarative `commands`; the backend plan is snapshot-tested.)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | L      |
| 0.6  | Strict project-name validation (npm rules, reject `..`, absolute, uppercase); target path containment. _(Landed 2026-09-30: npm rules implemented in `src/core/project-name.ts` (validate-npm-package-name 8 needs Node >= 22.22, above the CLI floor); `@scope/name` generates into `name/`; every planned path is checked with `resolveInside` before anything is written.)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | S      |
| 0.7  | Config file in/out: `--config stack.json`, write `.devstack/stack.json`; Zod schema v1. _(Landed 2026-09-30: `--config <file>` (`src/intake/config.ts`) and `.devstack/stack.json` in every project (`src/core/manifest.ts`). Schema v1 is `{ version: 1, name, packageManager?, modules, generatedBy? }` with unknown keys rejected. A manifest replays to the same file tree (tested), a command-line name overrides the config's, and `--config` with `--preset`/`--advanced` is rejected. The e2e matrix now includes a Nest 12 + Prisma combination through `--config`; all four runs (2 combinations × npm/pnpm) pass. The `$schema` URL waits for Q-08.)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | M      |
| 0.8  | Post-generation summary (next steps, env vars, warnings). CORS/origin permissive-default startup warning in templates. _(Landed 2026-09-30: `src/core/summary.ts` prints next steps in the project's package manager, the env vars to fill in, and warnings (permissive defaults, kept files, where overwritten originals were backed up). Modules declare `env` as data and the planner writes `.env.example` from it; that is the core of task 1.4, pulled forward. CORS and origin checks log a startup warning while `ALLOWED_ORIGINS` is empty.)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S      |
| 0.9  | Toolchain modernisation of the CLI: ESM + tsup, `@clack/prompts` behind `Prompter`, execa 9, zod 4, remove inquirer shim; `--verbose`; error taxonomy + exit codes. Template dotfiles are stored without the dot (`gitignore`) and renamed at plan time, because npm drops `.gitignore` from published tarballs and generated projects currently ship without one. _(Found by the e2e harness, 2026-09-30.)_ _(Landed 2026-09-30 with commander 15, execa 10, zod 4.6, vitest 5, ESLint 10, typescript-eslint 8.71 and TypeScript 6.0: typescript-eslint does not support TypeScript 7 yet. CLI engines `>=22.12` (commander 15's floor). Templates ship from `src/modules/_/files` and resolve from the package root, with no copy step.)\*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | M      |
| 0.10 | Docker v1 fixes: multi-stage, non-root, PM-aware install line, compose only adds DB service when a database module is selected, `.env` handling documented. _(Landed 2026-09-30: multi-stage Dockerfile (build → prod-deps → runtime) as the non-root `node` user, frozen-lockfile installs for the project's package manager, production install with `--ignore-scripts`, `prisma generate` when Prisma is selected, `node` as PID 1 for clean SIGTERM, and a `/health` HEALTHCHECK. Compose has no `version:` key, an optional `.env`, and a Postgres 18 `db` service with a healthcheck only when a database is selected. Both compose variants pass `docker compose config`. Verified with Docker on 2026-10-01: the npm and pnpm images build, run as `node`, pass `/health` and their HEALTHCHECK, and exit 0 on `docker stop`; `docker compose up --wait` brings Postgres and the app up healthy and the app connects with its compose `DATABASE_URL`. That run found two problems, both fixed: npm's production install kept the Prisma CLI and TypeScript (677 MB image, 350 MB after the fix, D-57), and the fixed host ports 3000/5432 collided with local services (now `${PORT:-3000}` and `${POSTGRES_PORT:-5432}`).)_                                                                                                           | S      |
| 0.11 | Delete `DEVSTACK-MASTER-DOC.md`; add `docs/adr/` with D-01..D-20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S      |

Exit gate: e2e matrix green for `backend` preset and Nest combo on npm and
pnpm; unit coverage of `src/core` ≥ 70%; `npm publish --dry-run` clean under
the new name; `--dry-run` output for the preset is snapshot-tested.

**Phase 0 status (2026-09-30):** all tasks landed. Exit gate:

| Check                                                                     | Status                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| e2e green for the `backend` preset and a Nest combination on npm and pnpm | met, all four runs pass every check (run locally, D-52)                                           |
| `src/core` coverage ≥ 70%                                                 | met: 82% statements, 79% branches, 77% functions, 82% lines                                       |
| `npm publish --dry-run` clean under the new name                          | met, no warnings                                                                                  |
| `--dry-run` output snapshot-tested                                        | met (backend plan snapshot)                                                                       |
| Docker image builds and passes its healthcheck                            | met 2026-10-01: npm and pnpm images healthy, non-root, clean stop; compose with Postgres verified |

Phase 0 exit gate met. 0.2.0 is published by the owner (`npx changeset version`, then `npm publish`).

## Phase 1 — Contract v2 and resolution engine (target: v0.3.0)

| #    | Task                                                                                                                                                                                                                             | Effort |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.1  | Types: `StackSpec`, `DevstackModule` v2, `ResolvedStack`, `GenerationPlan`, `Diagnostic`. Migration script converting the 16 modules.                                                                                            | M      |
| 1.2  | Resolver per B5 with full diagnostics; wizard implements the A0.2 order, skip rules, review screen, "save as preset" and "remember as defaults", and consumes diagnostics to offer fixes.                                        | L      |
| 1.3  | Planner: VFS with merge strategies; Eta templating; slot engine with per-framework fragments; unknown-token errors.                                                                                                              | L      |
| 1.4  | `env` declarations → `.env.example`; summary integration.                                                                                                                                                                        | S      |
| 1.5  | Node language adapter and npm/pnpm/yarn/bun PM adapters extracted from current code (behaviour-preserving refactor). `--pm` flag; lockfile-aware hooks/CI/Docker.                                                                | M      |
| 1.6  | Module options (`options` Zod schema) — first consumer: `rate-limit`.                                                                                                                                                            | S      |
| 1.7  | Plan snapshot tests for every preset; module tests for all 16 modules; contract lint (no fs/execa imports in modules).                                                                                                           | M      |
| 1.8  | `devstack modules list`, `devstack plan`, `devstack doctor`; the doctor checks run as the `init` pre-flight (D-44).                                                                                                              | S      |
| 1.9  | `when` conditions and `depth` on files/slots; `--depth` flag; integration-matrix coverage check.                                                                                                                                 | M      |
| 1.10 | Backend golden-path baseline (B17.2) for Express and Nest at `wired`: entry, app factory, env, logger, errors, request id, health/ready, shutdown and readiness slots, Supertest test, generated README. Prisma wired per B17.3. | L      |

Exit gate: all 16 modules on contract v2; resolver ≥ 90% coverage; e2e matrix
green on all four Node PMs; a deliberately invalid config yields all
diagnostics in one run; `backend` preset at `wired` passes `/ready` against a
real Postgres service container in CI.

## Phase 2 — Layouts and package managers (target: v0.4.0, part 1)

| #   | Task                                                                                                                                                                                                  | Effort |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2.1 | Layout adapter: `single` as one-target workspace (D-03).                                                                                                                                              | M      |
| 2.2 | `monorepo` layout: pnpm workspaces + Turborepo (default), yarn workspaces, bun workspaces, npm workspaces; root `tsconfig.base.json`, root lint/format, root CI. Target roles → paths.                | L      |
| 2.3 | Per-target manifests and installs; `packages/shared` scaffold module (`shared-types`).                                                                                                                | M      |
| 2.4 | e2e: monorepo with two backend-shaped targets, each PM.                                                                                                                                               | M      |
| 2.5 | Boot verification (B18): start built app(s), poll `/health`, `/ready` when data services are up, SIGTERM and assert clean exit; "Verified ✓" in summary.                                              | M      |
| 2.6 | Git finish and GitHub connect (A0.5, B18): init, `.env` ignore check, initial commit with hooks, URL validation, empty-remote check, confirmation, push, retry hint; e2e against a local bare remote. | M      |
| 2.7 | "Start it now?" prompt and `--start` flag.                                                                                                                                                            | S      |

Exit gate: monorepo preset with two targets installs from root, builds each
target, and Turborepo runs `build`/`lint` across both, on pnpm and bun; the backend preset
passes boot verification in CI; the finish pipeline pushes to a local bare remote and refuses a
non-empty one.

## Phase 3 — Node breadth (target: v0.4.0 part 2, v0.5.0)

| #    | Task                                                                                                                                                                                                                                                                                                                                                                                     | Effort |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 3.1  | Frameworks: `framework-fastify`, `framework-hono` with the full B17.2 baseline (Express and Nest done in 1.10); port all middleware/security modules to per-framework fragments for all four.                                                                                                                                                                                            | L      |
| 3.2  | Database category: `database-postgres`, `database-mysql`, `database-sqlite`, `database-mongodb`, `cache-redis` — compose services with healthchecks, env, readiness checks, disposers.                                                                                                                                                                                                   | M      |
| 3.3  | ORMs: `orm-drizzle`, `orm-mongoose`; Prisma 7 refresh; each wired per B17.3 with framework glue for all four frameworks; ORM ↔ database compatibility via `provides`/`requiresAny`.                                                                                                                                                                                                      | L      |
| 3.4  | `env-zod` module generating runtime env validation from aggregated `env`.                                                                                                                                                                                                                                                                                                                | M      |
| 3.5  | Testing: `testing-vitest`, `testing-jest` + Supertest scaffolds aware of framework; health test generated.                                                                                                                                                                                                                                                                               | M      |
| 3.6  | Quality: `quality-eslint` (flat) and `quality-prettier` always on (D-35); pre-commit bundle `quality-husky` with lint-staged, `quality-commitlint`, `quality-secret-scan` (Q-13).                                                                                                                                                                                                        | M      |
| 3.7  | DevOps: `devops-github-actions` (PM-aware, matrix), `devops-docker` v2, `devops-compose` running the whole stack (D-41).                                                                                                                                                                                                                                                                 | M      |
| 3.8  | Architecture layouts refreshed: `arch-flat`, `arch-mvc`, `arch-feature`, `arch-clean`, framework-aware, with folder-tree previews for the wizard and `.gitkeep` in empty folders.                                                                                                                                                                                                        | M      |
| 3.9  | Frontend: `framework-nextjs`, `framework-react-vite`. Fullstack wiring per B17.4: dev proxy, split-origin production config, ports config, `packages/shared` with envelope types and `apiClient`, status page, root Turborepo scripts. Fullstack preset `fullstack-next-hono`. Styling modules `ui-tailwind`, `ui-css-modules` for both frontends (D-42); frontend health routes (A0.3). | L      |
| 3.10 | Presets: `backend-express-prisma`, `backend-fastify-drizzle`, `backend-nest`, `fullstack-next-hono`; user presets in `~/.config/devstack/presets`.                                                                                                                                                                                                                                       | S      |
| 3.11 | App templates without auth (B17.8): `template-todo` (schema, service, repository adapters for all three ORMs, routes for all four frameworks, tests, seed, pages for both frontends) and `template-weather` (provider adapter, cache, routes, tests, pages).                                                                                                                             | XL     |
| 3.12 | Repo extras (B17.9): `repo-agents-md`, `repo-vscode`, `repo-github-hygiene`.                                                                                                                                                                                                                                                                                                             | M      |

Exit gate: every module in the e2e matrix in ≥1 combination per framework it
supports; fullstack preset e2e loads the web status page and gets
"API ✓ DB ✓" through the proxy; each preset passes at `bare` and `wired` and
with each template; nightly sampling job live.

## Phase 4 — Auth, observability, API docs (target: v0.6.0)

| #   | Task                                                                                                                                                                                                                                                                          | Effort |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 4.1 | `auth-jwt` (provides `auth`, enhancedBy ORMs), `auth-session` (requires `cache-redis`), wired per B17.5: shared auth core, `User` model and repository adapter per ORM, routes and `requireAuth` per framework, argon2 as a shared catalog dep (D-06), end-to-end auth tests. | L      |
| 4.2 | `auth-better-auth` with GitHub and Google social providers (D-38) — validates the service-wrapper pattern and `env` UX; OAuth flow tested against a mocked provider.                                                                                                          | M      |
| 4.3 | Observability: `obs-pino` options (pretty in dev, JSON in prod, redaction of auth headers), request logging; health/ready already in the baseline.                                                                                                                            | S      |
| 4.4 | `api-docs-scalar` (OpenAPI, framework-aware), Nest Swagger variant; auth and template routes documented when present.                                                                                                                                                         | M      |
| 4.5 | Frontend auth at `wired` (D-43): login/register/logout pages, OAuth buttons, protected-route helper, `apiClient` credentials, for both frontends; per-user Todo with ownership tests.                                                                                         | M      |

Exit gate: any two `auth` providers together are rejected with a fix
suggestion; `.env.example` complete for each auth choice; every auth module
green in the e2e matrix on all four backend frameworks and all three ORMs;
fullstack e2e with the Todo template registers, logs in, creates a todo, and
cannot read another user's todo.

## Phase 5 — Personalisation extras, `add`, MCP (target: v0.7.0)

| #   | Task                                                                                                                                              | Effort |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 5.1 | Code style knobs (semicolons, quotes, tabs, trailing commas, width) → Prettier config, and generated files formatted at plan time to match.       | M      |
| 5.2 | TS strictness tiers and ESM/CJS choice applied to every `tsconfig`/manifest.                                                                      | S      |
| 5.3 | Naming and metadata: app folder names, port, license, author, initial commit toggle.                                                              | S      |
| 5.4 | Remembered defaults `~/.config/devstack/config.json`; precedence flags > config file > preset > defaults; `devstack config set/get`.              | S      |
| 5.5 | User presets: `devstack presets save <name>` from any wizard result.                                                                              | S      |
| 5.6 | `devstack add <module>`: read manifest, re-resolve with additions, plan diff, apply only new/changed files with conflict policy, update manifest. | L      |
| 5.7 | `devstack mcp`: stdio MCP server exposing `list_modules`, `validate`, `plan`, `init`; diagnostics returned as structured data.                    | M      |

Exit gate: two generations of the same spec with different style knobs differ
only in formatting; `add rate-limit` on a generated Fastify project yields a
passing project; an MCP client can list modules, plan, and generate a preset
end-to-end.

## Phase 6 — 1.0 hardening (target: v1.0.0)

- Contract v2 frozen; deprecation policy; `LanguageAdapter` interface
  published (Node only) so 1.1 does not change the contract.
- Docs site; module reference generated from the registry; `$schema` hosted.
- Catalog/LTS policy: monthly Renovate cadence, Node default flips to the
  current LTS.
- Full nightly matrix and random-sampling job stable for 30 days before tag.

## Post-1.0 — Python and Go (targets: v1.1.0, v1.2.0)

| #   | Task                                                                                                                                             | Effort |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 7.1 | Python adapter: uv, `pyproject.toml`, `uv.lock`, `uv run`; `language-python`; `quality-ruff`, `quality-mypy`; `testing-pytest`.                  | L      |
| 7.2 | `framework-fastapi` with slots; `orm-sqlalchemy`, `env-pydantic-settings`; Docker/CI for Python. Then `framework-django`, `framework-flask`.     | XL     |
| 7.3 | Go adapter: `go.mod`, `go.work`; `language-go`; `framework-gin` or `framework-chi` (one first, Q-04); `orm-sqlc`; `quality-golangci`; Docker/CI. | XL     |
| 7.4 | Mixed-language monorepo: Go/Python `apps/api` + Next `apps/web` with Turborepo tasks.                                                            | L      |

Exit gate: a FastAPI project and a Go project generate, install, lint, test,
build and serve `/health` through the same CLI flow; no Python/Go-specific
code outside their adapters and modules.

Also post-1.0: standalone OAuth modules, Clerk/WorkOS, OTel/Sentry, Koa, SvelteKit/
Nuxt/Astro/Angular, tRPC/GraphQL, TypeORM, web stack builder, AI starters
(Q-05), external module loading design, and the items deferred in D-46.

## Working agreements

- **TDD for core:** resolver/planner/adapters get failing tests first.
  Modules get their module test and e2e matrix entry in the same PR.
- **Definition of done for a module:** contract-valid, catalog-only versions,
  slot fragments for every framework it supports, **`wired`-depth integration
  code per B17** (not just dependencies), readiness check and disposer if it
  holds a connection, `env` declared, every `when` pairing listed in the
  integration matrix with an e2e combination, module test, docs entry
  generated, summary text if it needs user action.
- **Review:** every PR touching `src/core` or `adapters` gets a security
  pass (input handling, command construction, path containment).
- **Commits:** conventional commits; Changesets entry for user-visible change.
- **Docs:** this file updated in the same PR when a decision or phase scope
  changes; ADR added under `docs/adr/` when a §7 entry is implemented.
- **Branching:** commit and push directly to `main`; no feature branches (owner decision,
  2026-09-30). Every commit passes lint, typecheck, test and build locally first, so `main`
  stays green; never force-push.

---

# §7. Decision log

Format: `D-nn (date) — decision. Rationale. Supersedes/relates.`

- **D-01 (2026-09-28)** — Single npm package until external modules exist.
  Rationale: one release pipeline, no premature package boundaries.
- **D-02 (2026-09-28)** — Internal module system first; external/third-party
  loading deferred to post-1.0. Carried from master doc.
- **D-03 (2026-09-28)** — Single-project layout is a workspace with exactly
  one target at `/`. Rationale: one code path for placement and manifests;
  monorepo is additive root config + paths. Resolves master doc §4.1.
- **D-04 (2026-09-28)** — `framework` is single-select **per target**, not
  per repo. Resolves master doc §3.2.
- **D-05 (2026-09-28)** — Database is its own category (`database-*`
  provides `db:<engine>`); ORMs declare `requiresAny` over the engines they
  support. Rationale: compose services, env vars and driver packages belong
  to the database, not the ORM. Resolves master doc Phase 2 question.
- **D-06 (2026-09-28)** — Password hashing is a catalog dependency
  (`argon2`) pulled in by auth modules, not a module. Resolves master doc
  Phase 3 question.
- **D-07 (2026-09-28)** — Code composition uses generation-time **slots**;
  runtime discovery of middleware (`require` in `try/catch`) is banned.
  Rationale: silent security bypass and lint failure in the current approach.
- **D-08 (2026-09-28)** — Versions live only in the catalog; literal versions
  in modules are lint errors.
- **D-09 (2026-09-28, amended by D-53)** — Generated projects target Node 24 minimum
  (`engines >=24`, Docker `node:24-alpine`; switch default to 26 after it
  enters LTS on 2026-10-28), ESLint 10 flat config, Prisma 7. Nest dev
  script must preserve decorator metadata (SWC or `ts-node`), not esbuild.
- **D-10 (2026-09-28)** — Templating engine is Eta; only `.eta` files are
  rendered; unknown tokens are errors.
- **D-11 (2026-09-28)** — Redis is a standalone `cache-redis` module used by
  session auth, rate limiting stores, queues. Carried from master doc.
- **D-12 (2026-09-28)** — Category enum is closed; adding one is a logged
  decision. Carried from master doc.
- **D-13 (2026-09-28)** — API docs target Scalar (Nest keeps Swagger
  variant). Carried from master doc.
- **D-14 (2026-09-28)** — Kubernetes/Terraform generation is last in DevOps
  priority. Carried from master doc.
- **D-15 (2026-09-28)** — Monorepo default tooling is pnpm workspaces +
  Turborepo; Nx not supported initially.
- **D-16 (2026-09-28)** — Python package manager is uv (no pip/poetry
  variants initially).
- **D-17 (2026-09-28)** — `--yes` never overwrites existing files; `--force`
  does. In-place generation always shows the conflict list before writing.
- **D-18 (2026-09-28)** — No telemetry by default; any future telemetry is
  opt-in with a documented payload.
- **D-19 (2026-09-28)** — CLI toolchain: ESM, tsup, `@clack/prompts` behind a
  `Prompter` interface, execa 9, zod 4. Rationale: current CJS pins
  (chalk 4, execa 5, inquirer 8 + hand-written shim) are maintenance debt.
- **D-20 (2026-09-28)** — `DEVSTACK-MASTER-DOC.md` is superseded by this file
  and is deleted in Phase 0.
- **D-21 (2026-09-28)** — 1.0 is **Node/TS only**. Python (1.1) and Go (1.2)
  follow once the module contract has survived four Node frameworks. The
  `LanguageAdapter` interface is published in 1.0 so adding a language does
  not change the contract.
- **D-22 (2026-09-28)** — Frontend in 1.0 is Next.js and React+Vite, with
  one fullstack preset, to prove monorepo + shared package. Wider frontend
  breadth is post-1.0.
- **D-23 (2026-09-28)** — Breadth policy: 2–4 fully integrated options per
  axis; no "community/untested" tier. 1.0 backend frameworks: Express,
  Fastify, Hono, NestJS. ORMs: Prisma, Drizzle, Mongoose. Auth: JWT, session,
  Better Auth.
- **D-24 (2026-09-28)** — Structure/style personalisation is in 1.0: code
  style knobs applied to generated files, TS strictness tiers, ESM/CJS,
  naming/metadata, and remembered defaults in `~/.config/devstack/config.json`
  with precedence flags > config file > preset > defaults.
- **D-25 (2026-09-28)** — `devstack add` and `devstack mcp` are in 1.0
  (Phase 5). Rationale: both are thin once the plan is pure data; `add` is
  what makes DevStack useful after day one, `mcp` is what makes it usable by
  agents.
- **D-26 (2026-09-28)** — DevStack generates a **running, wired system**
  (B17), not just installed packages. Every module's definition of done
  includes its integration code. Accepted cost: roughly +4–6 weeks to 1.0.
- **D-27 (2026-09-28, amended by D-39)** — Starter depth is a knob, `bare | wired | example`,
  default `wired`. `wired` contains no business-domain code.
- **D-28 (2026-09-28, superseded by D-39)** — The `example` domain is **Notes owned by the
  user**: CRUD, pagination, validation, and ownership authorization when auth
  is selected. Chosen over todos (reads as a toy) and users-only (overlaps
  auth, demonstrates less).
- **D-29 (2026-09-28)** — Fullstack production topology defaults to **split
  origin + CORS allowlist** (`WEB_ORIGIN`, never `*`). Dev uses a proxy
  (Next `rewrites` / Vite `server.proxy`) so CORS never arises locally.
  Same-origin via reverse proxy is post-1.0.
- **D-30 (2026-09-28)** — Port convention: web 3000, api 3001, defined once
  in the root manifest and read by both apps.
- **D-31 (2026-09-28)** — `.env` is generated for local development with
  working non-secret defaults and random local-only secrets; third-party
  secrets are left blank and listed in the summary. `.env` is always
  gitignored; `.env.example` is the committed contract.
- **D-32 (2026-09-28)** — Generated code follows ports and adapters (B17.6).
  Integration glue lives in the module that owns the adapted capability, via
  `when` conditions; there are no standalone glue modules.
- **D-33 (2026-09-28, refined by D-41)** — `db:up` is a separate command from `dev`; DevStack
  never starts Docker containers implicitly.
- **D-34 (2026-09-30)** — The wizard follows the fixed order in A0.2, preceded by a
  pre-flight check and ending in a review screen; nothing is written before the review.
  App type sets the layout (fullstack → monorepo). Every question has a flag.
- **D-35 (2026-09-30)** — ESLint 10 flat config and Prettier are always configured and never
  asked. Biome is dropped; lefthook moves to post-1.0, so Husky is the only hook runner.
  Rationale: one tested path, and formatting is not a stack choice. Amends A6 Quality.
- **D-36 (2026-09-30)** — Graceful shutdown, database connection lifecycle, `/health` and
  `/ready` are always generated at `wired`, not wizard options: they are correctness, not
  preference. CORS, Helmet, rate limit and request logging are a pre-checked multiselect;
  compression is unchecked.
- **D-37 (2026-09-30)** — Feature-scoped architecture (`arch-feature`) is in 1.0 and is the
  wizard default, replacing `arch-feature-sliced`. Resolves the A6 vs Phase 3.8 conflict.
- **D-38 (2026-09-30)** — OAuth (GitHub, Google) is in 1.0 only through Better Auth's social
  providers. Standalone OAuth modules, Clerk and WorkOS stay post-1.0.
- **D-39 (2026-09-30)** — App templates are an axis separate from stack presets (preset =
  which tech, template = which domain code), new category `template`, single per repo. 1.0
  ships Todo and Weather. `--depth` becomes `bare | wired`; `--template` replaces the
  `example` depth. Supersedes D-28 (Notes overlaps Todo), amends D-27.
- **D-40 (2026-09-30)** — GitHub connect targets an existing, empty repository by URL. Push
  happens only after gates and boot verification pass, after explicit confirmation (or
  `--github` with `--yes`), never with force, using the user's own git credentials; DevStack
  never handles tokens. A failed push is a warning, not a generation failure. Creating the
  repo via `gh` is post-1.0.
- **D-41 (2026-09-30)** — Compose defines the whole stack (data services, api, web) with
  healthchecks so `docker compose up` runs everything; `db:up` starts data services only.
  Refines D-33: `dev` still never starts containers.
- **D-42 (2026-09-30)** — Frontend styling is a wizard question: Tailwind (default), CSS
  Modules, none. New category `styling`, single-select per frontend target. shadcn/ui is
  post-1.0.
- **D-43 (2026-09-30)** — When auth and a frontend are both selected, frontend auth pages are
  generated at `wired` (previously `example` only). Rationale: backend auth with no login page
  reads as broken. Amends B17.5.
- **D-44 (2026-09-30)** — `init` runs the doctor checks as a pre-flight before the first
  question and a boot verification after install; an unverified project is never pushed.
- **D-45 (2026-09-30)** — Repo extras multiselect: `AGENTS.md` + `CLAUDE.md`, VS Code setup,
  GitHub hygiene files. Secret scanning joins the pre-commit bundle. New category `repo`,
  multi-select.
- **D-46 (2026-09-30)** — Considered and deferred to post-1.0: shadcn/ui, TanStack Query,
  Quick/Detailed wizard mode, extra services (email + Mailpit, file storage + MinIO, BullMQ
  jobs, DB admin UI), deploy targets, `gh repo create`, Sentry/OpenTelemetry, WebSockets,
  Stripe template, Expo, tRPC, devcontainer.
- **D-47 (2026-09-30)** — Vertical slice first: after Phases 0–1, one combination (Express +
  Prisma + Postgres + Next.js + Tailwind, pnpm + Turborepo) ships end to end, including
  fullstack wiring, the finish pipeline and the Todo template (0.4.0), then auth on it (0.5.0),
  then breadth (0.6.0). Rationale: proves every layer of the contract on one path before
  multiplying it, and brings the first release worth announcing forward by about 10 weeks.
  Reorders A9; Part C numbering unchanged.
- **D-48 (2026-09-30)** — Every file in the plan's virtual file system is formatted with
  Prettier, using the generated project's own config, before it is written. Rationale:
  "passes its own format check" becomes a property of the planner instead of per-template
  discipline, and the code-style knobs (5.1) become a config change. Cost: Prettier is a runtime
  dependency of the CLI.
- **D-49 (2026-09-30)** — Package name is `create-devstack-app` (free on npm, checked
  2026-09-30). Resolves Q-01.
- **D-50 (2026-09-30)** — The wizard uses `@clack/prompts` behind the `Prompter` interface.
  Resolves Q-02.
- **D-51 (2026-09-30)** — Nest dev runner uses SWC, which keeps decorator metadata and is
  faster than `ts-node`. Resolves Q-03.
- **D-52 (2026-09-30)** — No new GitHub Actions workflows until the project is feature-complete
  (owner decision). Existing `ci.yml` and `e2e.yml` stay and only receive edits needed to keep
  them working. Deferred: the release workflow with provenance (0.1), making e2e required,
  service-container and nightly matrices (B13). Until then, milestone gates are verified by
  running the e2e harness and the repo gates locally.
- **D-53 (2026-09-30, completed by D-56)** — Generated projects stay CommonJS until task 0.3, so Nest stays on 11 and
  Prisma on 6 in task 0.4. Nest 12 is ESM-only and Prisma 7 is ESM-first. Switching the generated
  project to ESM before 0.3 would make the template's runtime `require()` of middleware throw
  inside its `try/catch` and silently disable every security middleware. Task 0.3 rewrites those
  templates with slots, so the ESM switch, Nest 12 and Prisma 7 land there together. Amends D-09.
- **D-54 (2026-09-30, refined by D-58)** — Apply never deletes. All files are rendered and formatted in memory,
  written to a fresh staging directory under the OS temp dir, and only then copied into the
  project. A failure before the copy touches nothing; a failure during the copy stops and names
  every file already written plus the staging directory. There is no automatic rollback, because
  undoing would delete files (including ones the user chose to overwrite with `--force`).
  Rationale: owner requirement that generation contains no destructive operations; the conflict
  policy (D-17) already prevents unintended overwrites. Every file that is overwritten is first
  copied to `<staging>/backup/`, keeping its permissions, and the summary prints that location.
  Planned paths are walked with `lstat`: symlinks anywhere below the project directory, non-regular
  files and colliding paths (also case-insensitively) are refused before anything is written, and
  new files are created exclusively. Amends B3.
- **D-55 (2026-09-30)** — Generated apps own their shutdown on every framework: they handle
  SIGTERM and SIGINT, stop accepting connections, run their cleanup, and exit 0, or exit 1 if a
  10 s timeout passes. Nest does not use `enableShutdownHooks()`, which re-raises the signal after
  cleanup; the handler calls `app.close()`, which runs the same lifecycle hooks. The e2e harness
  boots the project's `start` command directly, because `npm run` re-raises SIGTERM and would hide
  the app's real exit status.
- **D-56 (2026-09-30)** — Prisma 7 setup in generated projects: the `prisma-client` generator
  writes to `src/generated/prisma` (git- and Prettier-ignored, rebuilt by `prisma generate` after
  install), the client connects through `@prisma/adapter-pg`, and the config is
  `prisma.config.mjs`. The config is plain JavaScript so the type-aware ESLint config lints it
  without a tsconfig entry, and it reads `DATABASE_URL` without Prisma's `env()` helper, which
  throws when the variable is unset and would fail `prisma generate` on every fresh install.
  Generated tsconfigs list `"types": ["node"]`, because TypeScript 6 no longer loads `@types`
  automatically. Completes D-53.
- **D-57 (2026-10-01)** — The npm production install in generated Dockerfiles is
  `npm ci --omit=dev --omit=optional --ignore-scripts`. Dev tools that are also optional peers of
  a runtime package (the Prisma CLI and TypeScript, via `@prisma/client`) are `devOptional` in
  npm's lockfile and survive `--omit=dev` alone; with them the image was 677 MB, without them
  350 MB. No catalog runtime dependency needs an optional dependency. pnpm's production install
  does not have this problem. Compose host ports are `${PORT:-3000}` and `${POSTGRES_PORT:-5432}`,
  while the container always listens on 3000.
- **D-58 (2026-10-01)** — DevStack cleans up its own temporary data and never anything else. After
  a successful write the CLI removes its staging copy; when files were overwritten it keeps the
  `backup/` folder, which the summary points to, and drops only the staged copies. After a failure
  everything stays, because the error message points at it. Tests remove the temp folders they
  create, and the e2e harness removes its work dir unless run with `--keep`. Measured: a full test
  run and both e2e legs now leave no temp folders, where one test run used to leave 26 (525
  folders, 15 GB, had accumulated). User files, other projects and their Docker resources are
  never touched. Refines D-54 (owner decision).

# §8. Open questions

| #    | Question                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner | Resolve by        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------- |
| Q-01 | **Resolved 2026-09-30 → D-49.** Package name. `create-devstack` and `devstack` are taken on npm. Available at time of writing: `create-devstack-cli`, `devstack-cli`, `create-devstack-app`, `@devstack/cli` (only if the scope is ours). Recommendation (updated 2026-09-30): the A0.1 flow wants the unscoped `npx create-<name>` form, so secure an unscoped `create-*` name such as `create-devstack-app`; a scope is the fallback. | Owner | Phase 0, task 0.1 |
| Q-02 | **Resolved 2026-09-30 → D-50.** Wizard library: `@clack/prompts` (recommended) vs `@inquirer/prompts`. Both fit behind `Prompter`.                                                                                                                                                                                                                                                                                                      | Owner | Phase 0, task 0.9 |
| Q-03 | **Resolved 2026-09-30 → D-51.** Nest dev runner: SWC (`@swc-node/register`) vs `ts-node`. Both keep decorator metadata; SWC is faster.                                                                                                                                                                                                                                                                                                  | Eng   | Phase 0, task 0.4 |
| Q-04 | First Go framework: Gin (popularity) vs chi (stdlib-aligned).                                                                                                                                                                                                                                                                                                                                                                           | Eng   | Before 1.2        |
| Q-05 | AI starter scope: agent scaffold vs RAG vs MCP server — which first.                                                                                                                                                                                                                                                                                                                                                                    | Owner | Post-1.0          |
| Q-06 | Frontend order after Next/React-Vite: SvelteKit vs Nuxt vs Astro vs Angular.                                                                                                                                                                                                                                                                                                                                                            | Owner | Post-1.0          |
| Q-07 | Whether `add` supports removal (`devstack remove`) in 0.7 or later.                                                                                                                                                                                                                                                                                                                                                                     | Owner | Phase 5           |
| Q-08 | Docs hosting (static site generator) and domain for `$schema` URL.                                                                                                                                                                                                                                                                                                                                                                      | Owner | Phase 1           |
| Q-09 | Upgrade story for generated projects when the catalog moves (e.g. Prisma 7 → 8): nothing automatic vs `devstack doctor` reporting drift against the catalog.                                                                                                                                                                                                                                                                            | Owner | Phase 6           |
| Q-10 | OS support: native Windows vs WSL only; the e2e matrix is Linux-only today.                                                                                                                                                                                                                                                                                                                                                             | Owner | Phase 2           |
| Q-11 | Partial-install UX: what the summary and exit code say when install fails after files are written.                                                                                                                                                                                                                                                                                                                                      | Eng   | Phase 0, task 0.5 |
| Q-12 | Command name for post-init commands: a second `bin` (`devstack add`) vs `npx <package> add`.                                                                                                                                                                                                                                                                                                                                            | Owner | Phase 1           |
| Q-13 | Secret scanner in pre-commit: gitleaks (Go binary, not on npm, separate install) vs secretlint (npm, catalog-pinned). Recommendation: secretlint by default, gitleaks when found on PATH.                                                                                                                                                                                                                                               | Eng   | Phase 3, task 3.6 |

# §9. Appendix — target module catalog (ids)

Language/runtime: `language-node`, `language-bun`, `language-python`, `language-go`
Layout: `layout-single`, `layout-monorepo-pnpm-turbo`, `layout-monorepo-yarn`, `layout-monorepo-bun`, `layout-monorepo-npm`, `layout-monorepo-uv`, `layout-monorepo-gowork`
Backend: `framework-express`, `framework-fastify`, `framework-hono`, `framework-koa`, `framework-nest`, `framework-fastapi`, `framework-django`, `framework-flask`, `framework-gin`, `framework-chi`, `framework-fiber`
API style: `api-rest`, `api-graphql-yoga`, `api-trpc`
Frontend: `framework-nextjs`, `framework-react-vite`, `framework-sveltekit`, `framework-nuxt`, `framework-astro`, `framework-angular`
Shared: `shared-types`, `shared-api-client`
Database: `database-postgres`, `database-mysql`, `database-sqlite`, `database-mongodb`, `cache-redis`
ORM: `orm-prisma`, `orm-drizzle`, `orm-typeorm`, `orm-mongoose`, `orm-sqlalchemy`, `orm-sqlc`, `orm-gorm`
Auth: `auth-jwt`, `auth-session`, `auth-oauth-github`, `auth-oauth-google`, `auth-better-auth`, `auth-clerk`, `auth-workos`
Env: `env-zod`, `env-pydantic-settings`, `env-go-envconfig`
Middleware/security: `middleware-cors`, `middleware-compression`, `middleware-request-logger`, `security-helmet`, `security-origin-checks`, `security-rate-limit`
Testing: `testing-vitest`, `testing-jest`, `testing-supertest`, `testing-playwright`, `testing-pytest`, `testing-go`
Quality: `quality-eslint`, `quality-prettier`, `quality-husky`, `quality-lefthook`, `quality-commitlint`, `quality-secret-scan`, `quality-ruff`, `quality-mypy`, `quality-golangci`
Architecture: `arch-flat`, `arch-mvc`, `arch-feature`, `arch-clean`, `arch-hexagonal`
Styling: `ui-tailwind`, `ui-css-modules`, `ui-shadcn`
Templates: `template-todo`, `template-weather`
Repo: `repo-agents-md`, `repo-vscode`, `repo-github-hygiene`
DevOps: `devops-docker`, `devops-compose`, `devops-github-actions`, `devops-gitlab-ci`, `devops-vercel`, `devops-fly`, `devops-railway`
Observability: `obs-pino`, `obs-winston`, `obs-otel`, `obs-sentry`, `obs-health`
API docs: `api-docs-scalar`, `api-docs-swagger`
AI (post-1.0): `ai-agent-claude`, `ai-rag-starter`, `ai-mcp-server`
