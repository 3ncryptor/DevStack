import { access } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import type { Probe } from '../src/core/doctor'
import { InputError } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import { AnswerPrompter } from './helpers/answer-prompter'
import { ScriptedPrompter } from './helpers/scripted-prompter'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)
afterEach(() => {
  vi.restoreAllMocks()
})

/** Collects what the CLI prints to stdout (the dry-run plan). */
function captureStdout(): () => string {
  const chunks: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(String(chunk))
    return true
  })
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  return () => chunks.join('')
}

const failingProbe: Probe = () => {
  throw new Error('the pre-flight must not run here')
}

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false
  )

describe('init flow', () => {
  it('runs the guided wizard and plans the answers (dry run skips the pre-flight)', async () => {
    const output = captureStdout()
    // answered by question; every other question takes its default
    const prompter = new AnswerPrompter([
      ['Backend framework', 'framework-nest'],
      ['Database', 'none'],
      ['App setup (app.ts)', ['security-helmet']]
    ])

    await runCreateDevstack({
      projectName: 'flow-app',
      options: { dryRun: true },
      prompter,
      probe: failingProbe
    })

    expect(output()).toContain('framework-nest')
    expect(output()).toContain('security-helmet')
    expect(output()).not.toContain('orm-prisma')
  })

  it('opens the review for --preset without --yes, and asks nothing with --yes', async () => {
    captureStdout()
    const reviewed = new ScriptedPrompter(['npm', 'generate'])
    await runCreateDevstack({
      projectName: 'flow-app',
      options: { preset: 'backend', dryRun: true },
      prompter: reviewed
    })
    const silent = new ScriptedPrompter([])
    await runCreateDevstack({
      projectName: 'flow-app',
      options: { preset: 'backend', yes: true, dryRun: true },
      prompter: silent
    })

    expect(reviewed.asked).toEqual(['Package manager', 'What next?'])
    expect(silent.asked).toEqual([])
  })

  it('stops before writing anything when the chosen package manager is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dir = await tempDir('devstack-flow-')
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const onlyNpm: Probe = (command, args) =>
      Promise.resolve(
        command === 'npm' || (command === 'git' && args[0] === '--version') ? '1.0.0' : undefined
      )

    const run = runCreateDevstack({
      projectName: 'pm-check',
      options: { yes: true, pm: 'bun', skipGit: true },
      prompter: new ScriptedPrompter([]),
      probe: onlyNpm
    })

    await expect(run).rejects.toThrow(InputError)
    await expect(run).rejects.toThrow(/bun: chosen for this project but not installed/)
    expect(await exists(path.join(dir, 'pm-check'))).toBe(false)
  })

  it('checks a package manager set by --pm before asking any question', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const prompter = new ScriptedPrompter([])
    const onlyNpm: Probe = (command) => Promise.resolve(command === 'npm' ? '1.0.0' : undefined)

    await expect(
      runCreateDevstack({
        projectName: 'pm-early',
        options: { pm: 'bun', skipGit: true },
        prompter,
        probe: onlyNpm
      })
    ).rejects.toThrow(/bun: chosen for this project but not installed/)
    expect(prompter.asked).toEqual([])
  })
})
