# create-devstack-app

Scaffold a running, wired TypeScript backend from the stack you choose. Every generated project
passes its own lint, format, typecheck and build on the first run, boots with a `/health` route,
and shuts down cleanly on `SIGTERM`.

> Status: 0.x, Phase 0 of the [build plan](./buildPlan.md). The stack menu is small today (Express
> or NestJS, optional Prisma + Postgres, security middleware, tooling, Docker). The plan lists
> what comes next.

## Quick start

```bash
npx create-devstack-app my-app
```

The wizard asks for your framework, database, folder layout, tooling and middleware. When it
finishes, the CLI prints the next commands for your package manager, the environment variables to
fill in, and any warnings (for example, CORS left open to every origin).

Requires Node.js 22.12 or newer. Generated projects target Node.js 24.

## What you get

- **Express 5, Fastify 5 or NestJS 12** on TypeScript (NodeNext), ESM or CommonJS, built around `createApp(deps)` so tests
  need no open port:
  - environment validated with Zod at startup, every missing or invalid variable listed at once;
  - pino JSON logs with a request id per request (echoed in `x-request-id`);
  - one response envelope: `{ success: true, data, meta? }` (`ApiSuccess`, with pagination
    `meta`) and `{ success: false, error: { code, message, requestId, details? } }` (`ApiError`),
    with no stack traces; Nest wraps return values for you;
  - Zod for env, request bodies, queries and params (`validate()` in Express, a pipe in Nest),
    and an optional `asyncHandler()` for Express;
  - `GET /health` (liveness) and `GET /ready` (503 with per-check status while, say, the database
    is down);
  - graceful shutdown: `SIGTERM`/`SIGINT` stop accepting connections, finish in-flight requests,
    close the database, and exit 0;
  - a Supertest test that passes on day one (`node:test`).
- **Fullstack in a monorepo** (pnpm, npm, yarn or bun workspaces with Turborepo): the API in
  `apps/api`, a Next.js 16 web app in `apps/web`, an optional admin app in `apps/admin`, and
  `packages/shared` with the response types and a typed API client. In development the web apps
  call the API through a `/api` proxy, so there is no CORS to configure; the API allows both web
  origins anyway. The home page shows "API ✓ connected · DB ✓ connected".
- **Folders for the architecture you pick:** feature-scoped, clean or MVC for the API;
  feature-based, layer-based or atomic design for the web apps, with `.gitkeep` in each folder.
- **Rate limiting your way:** fixed window, sliding window, token bucket or leaky bucket, with
  `RateLimit-*` headers and the standard error body on 429.
- **API versioning:** application routes under `/v1` if you want it; `/health` and `/ready`
  stay unversioned.
- **Security middleware you pick, imported explicitly:** Helmet, CORS, origin checks, rate
  limiting, request logging and compression. There is no runtime discovery, so a missing
  middleware is a compile error, never a silent no-op. Open CORS logs a warning at startup.
- **Prisma 7 + PostgreSQL** (optional): driver adapter, `prisma.config.mjs`, a client generated
  into `src/generated` after install, wired into `/ready` and shutdown, and `db:*` scripts
  (`db:up` starts the compose database when Docker is selected).
- **Email + password auth** (optional, Express + Prisma): register, login, refresh, logout and
  `GET /auth/me`; argon2id password hashes; a 15-minute JWT access token and a rotating 7-day
  refresh token, both in httpOnly cookies (a reused refresh token ends every session); writes
  carrying cookies must come from `ALLOWED_ORIGINS`; `requireAuth` and `requireRole('ADMIN')`
  for your routes, and `auth:make-admin <email>` to promote a user. `JWT_SECRET` gets a random
  value in your local `.env` only. Tests run on in-memory repositories, plus one against
  Postgres once it is migrated.
- **Better Auth** (optional, Express + Prisma): email + password and, if you pick them, GitHub
  and Google sign-in, with database sessions and admin roles; the client id and secret stay
  blank in `.env` until you add them.
- **Login pages in the web apps** whenever an API has auth: login, register, account and
  logout, OAuth buttons, and `<RequireAuth>` for protected pages; the admin app only lets admins
  in.
- **A Todo app to start from** (optional): list, filters, cursor pagination, create, edit,
  toggle and delete, from the Prisma model to a page in the web app; each user sees only their
  own todos when you pick auth; `db:seed` adds sample data and a demo user.
- **Repo extras** (on by default): `AGENTS.md` and `CLAUDE.md` describing your stack for AI
  assistants, VS Code settings, extensions and a debug launch, and GitHub hygiene files
  (Dependabot, PR and issue templates, CODEOWNERS).
- **Tooling that passes on day one:** ESLint 10 (flat config), Prettier, Husky + lint-staged +
  commitlint. Every generated file is formatted with the project's own Prettier config.
- **Docker** (optional): a multi-stage, non-root Dockerfile for your package manager with a
  `/health` healthcheck, and a compose file that only adds Postgres when you chose a database.
- **`.env.example`** built from what each module needs, a local `.env` with working defaults
  (never overwritten), a README for your stack, and `.devstack/stack.json`, a record of the stack
  you can regenerate from.
- **npm, pnpm, yarn or bun**, including pnpm's build-script approval (`allowBuilds`).

## Usage

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

The wizard first checks your machine (Node.js version, package managers, git identity), then
asks only the questions that apply: framework, module system (ESM or CommonJS), database and
ORM, package manager, architecture,
pre-commit hooks, Docker and what `app.ts` sets up. ESLint, Prettier and TypeScript are always
configured. Nothing is written until the review screen, where you can generate, change any
answer, save the stack as a named preset, remember your answers as defaults, or cancel. A
missing package manager is caught there too, before any file is written. If installing fails
after the files are written, they stay: the summary says "Not verified" and lists the commands
to run again, and what to check if one fails again.

`plan`, `modules`, `doctor`, `add`, `remove`, `config`, `presets` and `mcp` are commands, so a
project with one of those names needs the explicit form: `create-devstack-app init doctor`.

| Flag                        | Effect                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--preset <name>`           | Start from a preset, built in or your own (`presets list`); you still see the review screen unless you pass `--yes` |
| `--pm <name>`               | Package manager: `npm`, `pnpm`, `yarn` or `bun` (default: how you ran the CLI, then a lockfile here, then npm)      |
| `--depth <level>`           | `wired` (default): integration code included. `bare`: config, tooling and folders only                              |
| `--module-system <system>`  | `esm` (default) or `cjs`: how the API's code is loaded. Web apps stay ESM                                           |
| `--config <file>`           | Generate from a stack config, e.g. another project's `.devstack/stack.json`                                         |
| `--yes`                     | Accept defaults, never ask. Never overwrites existing files                                                         |
| `--force`                   | Overwrite existing files. Originals are backed up first                                                             |
| `--advanced`                | Pick modules one by one; the review screen offers fixes when they do not fit together                               |
| `--in-place`                | Generate into the current directory                                                                                 |
| `--dry-run`                 | Print the plan (files and commands) and stop                                                                        |
| `--print-plan [text\|json]` | Print the plan in a format; `json` never prompts                                                                    |
| `--skip-install`            | Do not install dependencies                                                                                         |
| `--skip-git`                | Do not initialise git or install hooks                                                                              |
| `--skip-verify`             | Skip the checks and boot test after install (the project is "Not verified")                                         |
| `--github <url>`            | Push the initial commit to this existing, empty GitHub repository                                                   |
| `--start`                   | Start the database and the dev servers when the project is ready                                                    |
| `--verbose`                 | Debug output and full error details                                                                                 |

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
module's schema, and defaults fill in the rest (rate limiting: `windowMs`, `limit`).

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
- Commands run without a shell.

## Develop

```bash
npm install
npm run dev -- my-app --dry-run   # run the CLI from source
npm test                          # unit tests
npm run test:coverage             # with coverage
npm run e2e                       # smoke: 4 stacks on pnpm, in parallel (~1 min)
npm run e2e:full                  # every stack on npm, pnpm, yarn and bun (~10 min)
npm run e2e -- --only fullstack-docker --keep   # one stack, keeping the project
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

Decisions and their reasons are in [`buildPlan.md` §7](./buildPlan.md#7-decision-log) and
indexed in [`docs/adr`](./docs/adr/README.md). See [CONTRIBUTING.md](./CONTRIBUTING.md),
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) and [SECURITY.md](./SECURITY.md).

## License

MIT
