# Releasing create-devstack-app

Releases are built and published by [`.github/workflows/release.yml`](.github/workflows/release.yml),
never from a laptop. A `v*.*.*` tag on `main` starts it; nothing is published until a maintainer
approves the `release` environment.

| Stage    | What it does                                                                                                                                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| verify   | The tag equals `v` + the `package.json` version, the commit is on `main`, `CHANGELOG.md` has a `## <version>` section (it becomes the release notes), and lint, format, typecheck and the unit tests pass; the npm tarball is packed once, and every later stage uses that file                       |
| rehearse | On Linux and macOS, [`scripts/npm-rehearse.sh`](scripts/npm-rehearse.sh) publishes the tarball to a throwaway local registry (twice: the second must be a no-op) and runs the release smoke test against it: `npx`, `pnpm dlx`, `bunx`, the `create` forms, both bins, the notices and the MCP server |
| publish  | Waits for approval. Then a draft GitHub Release with the tarball, npm with provenance through trusted publishing ([`scripts/npm-publish.sh`](scripts/npm-publish.sh)), and only then the release goes live                                                                                            |
| live     | Fresh Linux and macOS runners start the published version the same ways, and `npm audit signatures` verifies its signature and provenance                                                                                                                                                             |

A manual run (Actions → Release → Run workflow) is a **rehearsal**: every stage up to publish, which is
skipped. Run one before tagging.

## One-time setup

1. **npm account** that owns `create-devstack-app`, with two-factor authentication on.
2. **`release` environment** (Settings → Environments): required reviewer = the maintainers, deployment
   restricted to tags matching `v*`. Without it, a tag would publish without asking.
3. **Trusted publishing.** 1.0.0 was published by hand, so the package exists and npm can trust the
   workflow directly; no token is ever stored:

   ```sh
   npm login                       # the account that owns the package
   sh scripts/npm-trust.sh --dry-run
   sh scripts/npm-trust.sh         # trusts release.yml in the release environment
   ```

   Then on npmjs.com: the package → Settings → Publishing access → _Require two-factor
   authentication and disallow tokens_.

## Every release

1. Add a changeset for each user-visible change as you go (`npx changeset`). To release, run
   `npx changeset version` (it sets the version and writes `CHANGELOG.md`), then `npm install` so
   the lockfile carries the new version, and commit both on `main` with CI green.
2. Rehearse: Actions → Release → Run workflow on `main`. Everything must be green.
3. Tag and push:

   ```sh
   git switch main && git pull
   git tag -a v1.0.1 -m "create-devstack-app 1.0.1"
   git push origin v1.0.1
   ```

4. When verify and rehearse are green, approve the `release` deployment.
5. Watch the live stage, then check <https://www.npmjs.com/package/create-devstack-app> and the
   release page.

The first release through this workflow is the first real test of trusted publishing, so watch its
publish job. If npm answers 401 or 403 there, check `npx npm@11.20.0 trust list create-devstack-app`
(the workflow file, repository and environment must match exactly), fix it, and re-run the job.

## When something fails

- **Before publish:** fix it on `main`, delete the tag (`git push origin :refs/tags/v1.0.1`,
  `git tag -d v1.0.1`), and tag again.
- **During publish:** re-run the failed jobs. Every step can run again: the draft release gets its
  file replaced, and a version already on npm is skipped. If you give the version up instead, delete
  its draft release (`gh release delete v1.0.1`) so it doesn't linger.
- **After publish:** an npm version can never be reused, even after unpublishing. Fix forward with a
  patch release, and `npm deprecate create-devstack-app@<bad> "<why>"` if it is harmful to install.
  Don't unpublish: npm only allows it within 72 hours, and it breaks anyone who installed it.

## Checking a release as a user

```sh
npm audit signatures            # in a project with create-devstack-app installed
```
