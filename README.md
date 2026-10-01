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

- **Express 5 or NestJS 12** on ESM TypeScript (NodeNext), with a `/health` route and graceful
  shutdown: `SIGTERM`/`SIGINT` stop accepting connections, finish in-flight requests, and exit 0.
- **Security middleware you pick, imported explicitly:** Helmet, CORS, origin checks, rate
  limiting, request logging and compression. There is no runtime discovery, so a missing
  middleware is a compile error, never a silent no-op. Open CORS logs a warning at startup.
- **Prisma 7 + PostgreSQL** (optional): driver adapter, `prisma.config.mjs`, and a client generated
  into `src/generated` after install.
- **Tooling that passes on day one:** ESLint 10 (flat config), Prettier, Husky + lint-staged +
  commitlint. Every generated file is formatted with the project's own Prettier config.
- **Docker** (optional): a multi-stage, non-root Dockerfile for your package manager with a
  `/health` healthcheck, and a compose file that only adds Postgres when you chose a database.
- **`.env.example`** built from what each module needs, and `.devstack/stack.json`, a record of the
  stack you can regenerate from.
- **npm, pnpm, yarn or bun**, including pnpm's build-script approval (`allowBuilds`).

## Usage

```bash
create-devstack-app my-app                        # interactive wizard
create-devstack-app my-app --preset backend --yes # a preset, no questions
create-devstack-app my-app --config stack.json    # from a stack config
create-devstack-app . --in-place                  # into the current directory
create-devstack-app my-app --dry-run              # show the plan, write nothing
create-devstack-app my-app --preset backend --print-plan json
```

| Flag                        | Effect                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--preset <name>`           | Use a built-in preset (`backend`)                                                                              |
| `--pm <name>`               | Package manager: `npm`, `pnpm`, `yarn` or `bun` (default: how you ran the CLI, then a lockfile here, then npm) |
| `--config <file>`           | Generate from a stack config, e.g. another project's `.devstack/stack.json`                                    |
| `--yes`                     | Accept defaults, never ask. Never overwrites existing files                                                    |
| `--force`                   | Overwrite existing files. Originals are backed up first                                                        |
| `--advanced`                | Pick modules one by one                                                                                        |
| `--in-place`                | Generate into the current directory                                                                            |
| `--dry-run`                 | Print the plan (files and commands) and stop                                                                   |
| `--print-plan [text\|json]` | Print the plan in a format; `json` never prompts                                                               |
| `--skip-install`            | Do not install dependencies                                                                                    |
| `--skip-git`                | Do not initialise git or install hooks                                                                         |
| `--verbose`                 | Debug output and full error details                                                                            |

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

Every generated project records its own config in `.devstack/stack.json`; passing it to
`--config` regenerates the same files.

## Safety

- Nothing is written until the whole plan has rendered. Files are staged in a temp directory,
  then copied in.
- `--yes` never overwrites. With `--force` or an interactive "overwrite", originals are copied to
  a backup directory first and the summary says where. Nothing is ever deleted.
- Symlinks, non-regular files and paths outside the project are refused before anything is written.
- Project names follow npm's rules, including reserved and Windows device names.
- Commands run without a shell.

## Develop

```bash
npm install
npm run dev -- my-app --dry-run   # run the CLI from source
npm test                          # unit tests
npm run test:coverage             # with coverage
npm run e2e -- --pm pnpm --keep   # generate projects and run their own gates
npm run lint && npm run typecheck && npm run build
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

1. Create `src/modules/<id>/index.ts` exporting a `DevstackModule`, and register it in
   `src/modules/index.ts`.
2. List packages by name. Add their versions to `src/catalog/node.ts`; a test rejects literal
   versions in modules.
3. Put templates in `src/modules/<id>/files` (`filesPath: moduleFilesPath('<id>')`). Name a file
   `*.eta` to render it; store `.gitignore` as `gitignore`.
4. Contribute framework code through `slots` (`app.imports`, `app.middleware`), environment
   variables through `env`, and post-install steps through `commands`.
5. Add tests, and add a combination to `tests/e2e/matrix.json`.

Decisions and their reasons are in [`buildPlan.md` §7](./buildPlan.md#7-decision-log) and
indexed in [`docs/adr`](./docs/adr/README.md). See [CONTRIBUTING.md](./CONTRIBUTING.md),
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) and [SECURITY.md](./SECURITY.md).

## License

MIT
