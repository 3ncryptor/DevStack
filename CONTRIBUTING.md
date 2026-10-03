# Contributing

Thanks for contributing to `create-devstack`.

## Prerequisites

- Node.js >= 18.18
- npm, pnpm, yarn, or bun

## Local setup

```bash
npm install
npm run build
npm link
```

## Development flow

1. Create a branch prefixed with `codex/`.
2. Make focused changes.
3. Run checks before opening a PR:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

4. Use Conventional Commits (examples: `feat:`, `fix:`, `chore:`).
5. Update docs and tests for behavior changes.

## Module contribution guidelines

- Keep each module single-purpose.
- Declare `requires`, `requiresAny`, and `conflictsWith` accurately.
- Put each module in `src/modules/<language>/<category>/<name>/` (`common/` for language-agnostic
  ones such as databases), templates in its `files/` folder, and register it with its folder in
  `src/modules/registry.ts`. Never rename a module's `id`; folders may move, ids may not.
- Avoid adding framework-specific logic to unrelated modules.
