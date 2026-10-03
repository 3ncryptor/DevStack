import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { commitProject, INITIAL_COMMIT_MESSAGE } from '../src/core/finish/git'
import { connectGitHub, githubUrlProblem } from '../src/core/finish/github'
import { finishProject } from '../src/core/finish/index'
import { runGates } from '../src/core/finish/verify'
import { ApplyError } from '../src/errors'
import type { GenerationPlan, PlannedFile } from '../src/types/plan'
import { ConsoleLogger } from '../src/utils/logger'
import { runCommand, type CommandRunner } from '../src/utils/process'
import { ScriptedPrompter } from './helpers/scripted-prompter'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'
import { DEFAULT_SETTINGS } from '../src/core/settings'

afterAll(removeTempDirs)
afterEach(() => {
  vi.unstubAllEnvs()
})

const logger = new ConsoleLogger({ silent: true })
const REMOTE_URL = 'https://github.com/devstack-test/demo.git'

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/**
 * A git config of the test's own (never the developer's): an identity, and REMOTE_URL rewritten
 * to a local bare repository standing in for GitHub.
 */
async function isolatedGit(options: { identity: boolean }): Promise<{ bare: string }> {
  const home = await tempDir('devstack-git-home-')
  const bare = path.join(home, 'remote.git')
  execFileSync('git', ['init', '--bare', '--quiet', '-b', 'main', bare])
  const config = [
    ...(options.identity
      ? ['[user]', '  name = DevStack Test', '  email = test@devstack.invalid']
      : []),
    `[url "file://${bare}"]`,
    `  insteadOf = ${REMOTE_URL}`
  ].join('\n')
  const file = path.join(home, 'gitconfig')
  await writeFile(file, `${config}\n`)
  vi.stubEnv('GIT_CONFIG_GLOBAL', file)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  return { bare }
}

async function project(files: Record<string, string>): Promise<string> {
  const dir = await tempDir('devstack-finish-')
  git(dir, 'init', '--quiet', '-b', 'main')
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, name), content)
  }
  return dir
}

describe('GitHub URLs (A0.5)', () => {
  it.each([
    'https://github.com/acme/api',
    'https://github.com/acme/api.git',
    'git@github.com:acme/api.git'
  ])('accepts %s', (url) => {
    expect(githubUrlProblem(url)).toBeUndefined()
  })

  it.each([
    'https://gitlab.com/acme/api',
    'http://github.com/acme/api',
    'https://github.com/acme',
    'https://github.com/acme/api; rm -rf /',
    'git@github.com:acme/api',
    'file:///tmp/repo.git'
  ])('rejects %s', (url) => {
    expect(githubUrlProblem(url)).toBeDefined()
  })
})

describe('initial commit (A0.4 step 4)', () => {
  it('commits everything, with the conventional message, once .env is ignored', async () => {
    await isolatedGit({ identity: true })
    const dir = await project({
      '.gitignore': '.env\n',
      '.env': 'SECRET=1\n',
      'index.ts': 'export {}\n'
    })

    const outcome = await commitProject(dir, runCommand, {
      preexistingRepo: false,
      envFiles: ['.env']
    })

    expect(outcome.status).toBe('committed')
    expect(git(dir, 'log', '--format=%s')).toBe(INITIAL_COMMIT_MESSAGE)
    expect(git(dir, 'ls-files').split('\n')).toEqual(['.gitignore', 'index.ts'])
  })

  it('commits nothing when a .env file would be committed', async () => {
    await isolatedGit({ identity: true })
    const dir = await project({ '.env': 'SECRET=1\n' })

    const outcome = await commitProject(dir, runCommand, {
      preexistingRepo: false,
      envFiles: ['.env']
    })

    expect(outcome).toMatchObject({ status: 'skipped' })
    expect(() => git(dir, 'rev-parse', 'HEAD')).toThrow()
  })

  it('leaves a repository that existed before alone', async () => {
    await isolatedGit({ identity: true })
    const dir = await project({ 'index.ts': 'export {}\n' })

    const outcome = await commitProject(dir, runCommand, { preexistingRepo: true, envFiles: [] })

    expect(outcome).toMatchObject({ status: 'skipped' })
    expect(() => git(dir, 'rev-parse', 'HEAD')).toThrow()
  })

  it('explains how to set the identity when git has none', async () => {
    await isolatedGit({ identity: false })
    const dir = await project({ 'index.ts': 'export {}\n' })

    const outcome = await commitProject(dir, runCommand, { preexistingRepo: false, envFiles: [] })

    expect(outcome).toMatchObject({
      status: 'skipped',
      reason: expect.stringContaining('git config --global user.email') as string
    })
  })
})

describe('GitHub connect (A0.5, D-40)', () => {
  async function committedProject(): Promise<string> {
    const dir = await project({ 'index.ts': 'export {}\n' })
    await commitProject(dir, runCommand, { preexistingRepo: false, envFiles: [] })
    return dir
  }

  it('pushes main to an empty repository after confirmation', async () => {
    const { bare } = await isolatedGit({ identity: true })
    const dir = await committedProject()

    const outcome = await connectGitHub(dir, REMOTE_URL, runCommand, () => Promise.resolve(true))

    expect(outcome).toEqual({ status: 'pushed', url: REMOTE_URL })
    expect(git(bare, 'log', '--format=%s', 'main')).toBe(INITIAL_COMMIT_MESSAGE)
  })

  it('refuses a repository that already has commits, and never forces', async () => {
    await isolatedGit({ identity: true })
    const first = await committedProject()
    await connectGitHub(first, REMOTE_URL, runCommand, () => Promise.resolve(true))
    const second = await committedProject()

    const outcome = await connectGitHub(second, REMOTE_URL, runCommand, () => Promise.resolve(true))

    expect(outcome).toMatchObject({
      status: 'skipped',
      reason: expect.stringContaining('already has commits') as string
    })
    expect(git(second, 'remote')).toBe('')
  })

  it('adds no remote when the push is not confirmed', async () => {
    await isolatedGit({ identity: true })
    const dir = await committedProject()

    const outcome = await connectGitHub(dir, REMOTE_URL, runCommand, () => Promise.resolve(false))

    expect(outcome).toMatchObject({ status: 'skipped' })
    expect(git(dir, 'remote')).toBe('')
  })
})

function planWith(scripts: Record<string, string>, dir = '/virtual/gates'): GenerationPlan {
  const manifest: PlannedFile = {
    path: 'package.json',
    content: JSON.stringify({ name: 'gates', scripts }),
    mode: 0o644,
    strategy: 'create',
    source: 'test'
  }
  return {
    projectName: 'gates',
    projectDir: dir,
    packageManager: 'pnpm',
    modules: [],
    files: [manifest],
    commands: [],
    env: [],
    depth: 'wired',
    settings: DEFAULT_SETTINGS
  }
}

describe('verification gates (A0.4 step 2)', () => {
  it('runs the gates the project has, in order, with its package manager', async () => {
    const calls: string[] = []
    const run: CommandRunner = (command, args) => {
      calls.push([command, ...args].join(' '))
      return Promise.resolve({ ok: true, exitCode: 0, output: '', stdout: '' })
    }

    const gates = await runGates(
      planWith({ build: 'tsc', lint: 'eslint .', dev: 'x' }),
      run,
      logger
    )

    expect(gates).toEqual(['lint', 'build'])
    expect(calls).toEqual(['pnpm run lint', 'pnpm run build'])
  })

  it('stops at the first failing gate with its output', async () => {
    const run: CommandRunner = (_command, args) =>
      Promise.resolve(
        args.includes('typecheck')
          ? { ok: false, exitCode: 2, output: 'src/app.ts(3,1): error TS2322', stdout: '' }
          : { ok: true, exitCode: 0, output: '', stdout: '' }
      )

    const gates = runGates(planWith({ lint: 'a', typecheck: 'b', build: 'c' }), run, logger)

    await expect(gates).rejects.toThrow(ApplyError)
    await expect(gates).rejects.toThrow(/typecheck[\s\S]*error TS2322/)
  })
})

describe('finishProject', () => {
  it('never pushes a project that was not verified', async () => {
    await isolatedGit({ identity: true })
    const dir = await project({ 'index.ts': 'export {}\n' })

    const result = await finishProject({
      plan: planWith({}, dir),
      skipInstall: true,
      skipVerify: false,
      skipGit: false,
      github: REMOTE_URL,
      yes: true,
      preexistingRepo: false,
      prompter: new ScriptedPrompter([]),
      logger
    })

    expect(result.verification.status).toBe('skipped')
    expect(result.commit?.status).toBe('committed')
    expect(result.push).toMatchObject({
      status: 'skipped',
      reason: expect.stringContaining('not verified') as string
    })
  })

  it('commits nothing when the settings turn the initial commit off (task 5.3)', async () => {
    await isolatedGit({ identity: true })
    const dir = await project({ 'index.ts': 'export {}\n' })
    const plan = { ...planWith({}, dir), settings: { ...DEFAULT_SETTINGS, initialCommit: false } }

    const result = await finishProject({
      plan,
      skipInstall: true,
      skipVerify: true,
      skipGit: false,
      yes: true,
      preexistingRepo: false,
      prompter: new ScriptedPrompter([]),
      logger
    })

    expect(result.commit).toMatchObject({
      status: 'skipped',
      reason: expect.stringContaining('initialCommit: false') as string
    })
  })
})
