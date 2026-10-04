# DevStack website

The public site (D-99, buildPlan Phase 7): landing page, stack builder, docs. It runs DevStack's
own resolver and wizard from `../src/browser.ts`, and reads the modules from
`src/generated/modules.json`, which `npm run data` writes from the registry before `dev`, `build`
and `typecheck`.

```bash
npm ci --prefix .. && npm ci   # the repository root too: the shared core needs its packages
npm run dev                    # http://localhost:3000
npm run build && npm run lint && npm run typecheck
```

Deployed by Vercel's Git integration with the project's root directory set to `website/`;
`vercel.json` installs the repository root first and skips builds when neither the site nor the
shared code changed.
