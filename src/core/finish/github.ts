import type { CommandRunner } from '../../utils/process'

/** github.com only (D-40); anything else is rejected before git sees it. */
const HTTPS_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(\.git)?$/
const SSH_URL = /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/

/** Why a GitHub URL is not accepted, or undefined when it is. */
export function githubUrlProblem(url: string): string | undefined {
  return HTTPS_URL.test(url) || SSH_URL.test(url)
    ? undefined
    : 'Use https://github.com/<owner>/<repo>(.git) or git@github.com:<owner>/<repo>.git'
}

export type PushOutcome =
  | { status: 'pushed'; url: string }
  | { status: 'skipped' | 'failed'; reason: string; retry?: string }

const LS_REMOTE_TIMEOUT_MS = 30_000
const PUSH_TIMEOUT_MS = 120_000
// git uses the user's own credentials (SSH, credential helper, gh) but never prompts: a missing
// login is reported with the retry command instead of hanging the CLI
const GIT_ENV = { GIT_TERMINAL_PROMPT: '0' }
const RETRY = 'git push -u origin main'

/**
 * GitHub connect (A0.5, D-40): the repo must exist and be empty, the user confirms, and the push
 * is never forced. Every failure is a warning: the project is already complete locally.
 */
export async function connectGitHub(
  projectDir: string,
  url: string,
  run: CommandRunner,
  confirm: () => Promise<boolean>
): Promise<PushOutcome> {
  const problem = githubUrlProblem(url)
  if (problem !== undefined) return { status: 'skipped', reason: problem }
  const options = { cwd: projectDir, env: GIT_ENV }

  const remote = await run('git', ['ls-remote', url], {
    ...options,
    timeoutMs: LS_REMOTE_TIMEOUT_MS
  })
  if (!remote.ok) {
    return { status: 'failed', reason: `Could not reach ${url}:\n${remote.output}`, retry: RETRY }
  }
  if (remote.stdout.trim() !== '') {
    return {
      status: 'skipped',
      reason: `${url} already has commits (a README created on GitHub, for example); DevStack only pushes to an empty repository and never forces.`
    }
  }
  if (!(await confirm())) return { status: 'skipped', reason: 'Push not confirmed.', retry: RETRY }

  const added = await run('git', ['remote', 'add', 'origin', url], options)
  if (!added.ok) return { status: 'failed', reason: added.output, retry: RETRY }
  const pushed = await run('git', ['push', '-u', 'origin', 'main'], {
    ...options,
    timeoutMs: PUSH_TIMEOUT_MS
  })
  return pushed.ok
    ? { status: 'pushed', url }
    : { status: 'failed', reason: pushed.output, retry: RETRY }
}
