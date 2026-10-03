import path from 'node:path'

import { ApplyError } from '../../errors'
import type { Prompter } from '../../intake/prompter'
import type { GenerationPlan } from '../../types/plan'
import type { Logger } from '../../utils/logger'
import { runCommand, type CommandRunner } from '../../utils/process'
import { bootCheck } from './boot'
import { commitProject, type CommitOutcome } from './git'
import { connectGitHub, type PushOutcome } from './github'
import { runGates } from './verify'

export type Verification =
  | { status: 'verified'; gates: string[]; booted: string[]; readiness: string[] }
  | { status: 'skipped'; reason: string }

export interface FinishResult {
  verification: Verification
  commit?: CommitOutcome
  push?: PushOutcome
}

export interface FinishInput {
  plan: GenerationPlan
  skipInstall: boolean
  skipVerify: boolean
  skipGit: boolean
  /** Existing, empty GitHub repository to push to (A0.5). */
  github?: string
  /** With --github, --yes pushes without asking (D-40). */
  yes: boolean
  /** The folder was a git repository before generation. */
  preexistingRepo: boolean
  prompter: Prompter
  logger: Logger
  run?: CommandRunner
}

async function verify(input: FinishInput, run: CommandRunner): Promise<Verification> {
  if (input.skipInstall) {
    return { status: 'skipped', reason: 'dependencies were not installed (--skip-install)' }
  }
  if (input.skipVerify) return { status: 'skipped', reason: '--skip-verify' }
  const gates = await runGates(input.plan, run, input.logger)
  input.logger.info('Checking the project: booting it...')
  const boot = await bootCheck(input.plan)
  if (!boot.ok) {
    throw new ApplyError(
      `The generated project did not boot cleanly:\n${boot.problems.join('\n')}\n` +
        'The files are written; start it yourself to see the problem.'
    )
  }
  return { status: 'verified', gates, booted: boot.booted, readiness: boot.readiness }
}

async function push(
  input: FinishInput,
  result: Pick<FinishResult, 'verification' | 'commit'>,
  run: CommandRunner
): Promise<PushOutcome | undefined> {
  if (input.github === undefined) return undefined
  // an unverified project is never pushed (D-44)
  if (result.verification.status !== 'verified') {
    return { status: 'skipped', reason: 'The project was not verified, so it was not pushed.' }
  }
  if (result.commit?.status !== 'committed') {
    return { status: 'skipped', reason: 'There is no commit to push.' }
  }
  const url = input.github
  return connectGitHub(input.plan.projectDir, url, run, () =>
    input.yes
      ? Promise.resolve(true)
      : input.prompter.confirm({ message: `Push to ${url} on main?`, initialValue: true })
  )
}

/**
 * After install (A0.4, B18): the project's own gates, a boot check, the initial commit and the
 * optional GitHub push. Failing gates or boot stop with exit 1; git and GitHub only warn.
 */
/** The settings turned the initial commit off (task 5.3): git is set up, nothing committed. */
const NO_INITIAL_COMMIT: CommitOutcome = {
  status: 'skipped',
  reason: 'The initial commit is turned off in the settings (initialCommit: false).'
}

export async function finishProject(input: FinishInput): Promise<FinishResult> {
  const run = input.run ?? runCommand
  const verification = await verify(input, run)
  const envFiles = input.plan.files
    .filter((file) => path.posix.basename(file.path) === '.env')
    .map((file) => file.path)
  const commit = input.skipGit
    ? undefined
    : !input.plan.settings.initialCommit
      ? NO_INITIAL_COMMIT
      : await commitProject(input.plan.projectDir, run, {
          preexistingRepo: input.preexistingRepo,
          envFiles
        })
  return { verification, commit, push: await push(input, { verification, commit }, run) }
}
