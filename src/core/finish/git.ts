import type { CommandRunner } from '../../utils/process'

export const INITIAL_COMMIT_MESSAGE = 'chore: initial project setup (devstack)'

export type CommitOutcome =
  { status: 'committed'; sha: string } | { status: 'skipped'; reason: string }

export interface CommitOptions {
  /** The folder was a git repository before generation: its history is the user's. */
  preexistingRepo: boolean
  /** Planned .env files, which must be ignored before anything is staged. */
  envFiles: readonly string[]
}

/**
 * The initial commit (A0.4 step 4): only in a repository DevStack created, only once every .env
 * is ignored, with the project's own hooks running. A skip is a warning with the reason.
 */
export async function commitProject(
  projectDir: string,
  run: CommandRunner,
  options: CommitOptions
): Promise<CommitOutcome> {
  if (options.preexistingRepo) {
    return {
      status: 'skipped',
      reason: 'This folder was already a git repository; review and commit the changes yourself.'
    }
  }
  const at = { cwd: projectDir }
  const email = await run('git', ['config', 'user.email'], at)
  if (!email.ok || email.stdout.trim() === '') {
    return {
      status: 'skipped',
      reason:
        'git user.email is not set. Run git config --global user.email "<you@example.com>", then commit.'
    }
  }
  for (const envFile of options.envFiles) {
    const ignored = await run('git', ['check-ignore', '--quiet', envFile], at)
    if (!ignored.ok) {
      return {
        status: 'skipped',
        reason: `${envFile} is not ignored by .gitignore, so nothing was committed (it holds local secrets).`
      }
    }
  }
  const added = await run('git', ['add', '--all'], at)
  if (!added.ok) return { status: 'skipped', reason: `git add failed:\n${added.output}` }
  const committed = await run('git', ['commit', '--message', INITIAL_COMMIT_MESSAGE], at)
  if (!committed.ok) {
    return {
      status: 'skipped',
      reason: `The initial commit failed (a hook?):\n${committed.output}`
    }
  }
  const head = await run('git', ['rev-parse', '--short', 'HEAD'], at)
  return { status: 'committed', sha: head.stdout.trim() }
}
