import { chmod, mkdir, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applyPlan, classifyFiles } from '../src/core/apply/index'
import { Aborted, InputError } from '../src/errors'
import type { GenerationPlan, PlannedFile } from '../src/types/plan'
import { ConsoleLogger } from '../src/utils/logger'
import { ScriptedPrompter } from './helpers/scripted-prompter'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

const logger = new ConsoleLogger({ silent: true })

/** Each test gets its own fresh directory, removed when this file's tests are done. */
function freshDir(): Promise<string> {
  return tempDir('devstack-apply-test-')
}

afterAll(removeTempDirs)

/** Staging (and its backups) goes under a test-owned folder so nothing outlives the tests. */
let stagingRoot = ''
beforeAll(async () => {
  stagingRoot = await tempDir('devstack-apply-staging-')
})

function file(filePath: string, content: string, extra: Partial<PlannedFile> = {}): PlannedFile {
  return { path: filePath, content, mode: 0o644, strategy: 'create', source: 'test', ...extra }
}

function planFor(projectDir: string, files: PlannedFile[]): GenerationPlan {
  return {
    projectName: 'apply-test',
    projectDir,
    packageManager: 'npm',
    modules: [],
    files,
    commands: [],
    env: [],
    depth: 'wired'
  }
}

async function existing(projectDir: string, filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(projectDir, filePath)), { recursive: true })
  await writeFile(path.join(projectDir, filePath), content)
}

const read = (projectDir: string, filePath: string) =>
  readFile(path.join(projectDir, filePath), 'utf8')

describe('applyPlan', () => {
  it('writes every planned file with its mode into an empty directory', async () => {
    const dir = await freshDir()
    const plan = planFor(dir, [
      file('src/app.ts', 'export {}\n'),
      file('.husky/pre-commit', 'lint-staged\n', { mode: 0o755 })
    ])

    const result = await applyPlan(plan, {
      yes: true,
      force: false,
      prompter: new ScriptedPrompter([]),
      logger,
      tempRoot: stagingRoot
    })

    expect(result.written).toEqual(['.husky/pre-commit', 'src/app.ts'])
    expect(await read(dir, 'src/app.ts')).toBe('export {}\n')
    expect((await stat(path.join(dir, '.husky/pre-commit'))).mode & 0o777).toBe(0o755)
  })

  it('never overwrites with --yes: it stops before writing anything', async () => {
    const dir = await freshDir()
    await existing(dir, 'src/app.ts', 'mine\n')
    const plan = planFor(dir, [file('src/app.ts', 'generated\n'), file('README.md', '# new\n')])

    await expect(
      applyPlan(plan, {
        yes: true,
        force: false,
        prompter: new ScriptedPrompter([]),
        logger,
        tempRoot: stagingRoot
      })
    ).rejects.toThrow(InputError)
    expect(await read(dir, 'src/app.ts')).toBe('mine\n')
    await expect(stat(path.join(dir, 'README.md'))).rejects.toThrow()
  })

  it('overwrites existing files with --force', async () => {
    const dir = await freshDir()
    await existing(dir, 'src/app.ts', 'mine\n')

    await applyPlan(planFor(dir, [file('src/app.ts', 'generated\n')]), {
      yes: true,
      force: true,
      prompter: new ScriptedPrompter([]),
      logger,
      tempRoot: stagingRoot
    })

    expect(await read(dir, 'src/app.ts')).toBe('generated\n')
  })

  it('keeps an existing file whose strategy is skip-if-exists, without asking', async () => {
    const dir = await freshDir()
    await existing(dir, 'README.md', '# mine\n')
    const prompter = new ScriptedPrompter([])

    const result = await applyPlan(
      planFor(dir, [file('README.md', '# generated\n', { strategy: 'skip-if-exists' })]),
      { yes: false, force: false, prompter, logger, tempRoot: stagingRoot }
    )

    expect(await read(dir, 'README.md')).toBe('# mine\n')
    expect(result.kept).toEqual(['README.md'])
    expect(prompter.asked).toEqual([])
  })

  it('lets an interactive user keep existing files and still writes the new ones', async () => {
    const dir = await freshDir()
    await existing(dir, 'src/app.ts', 'mine\n')
    const plan = planFor(dir, [file('src/app.ts', 'generated\n'), file('README.md', '# new\n')])

    await applyPlan(plan, {
      yes: false,
      force: false,
      prompter: new ScriptedPrompter(['skip']),
      logger,
      tempRoot: stagingRoot
    })

    expect(await read(dir, 'src/app.ts')).toBe('mine\n')
    expect(await read(dir, 'README.md')).toBe('# new\n')
  })

  it('aborts without writing when the user chooses to', async () => {
    const dir = await freshDir()
    await existing(dir, 'src/app.ts', 'mine\n')
    const plan = planFor(dir, [file('src/app.ts', 'generated\n'), file('README.md', '# new\n')])

    await expect(
      applyPlan(plan, {
        yes: false,
        force: false,
        prompter: new ScriptedPrompter(['abort']),
        logger,
        tempRoot: stagingRoot
      })
    ).rejects.toThrow(Aborted)
    await expect(stat(path.join(dir, 'README.md'))).rejects.toThrow()
  })

  it('refuses a planned path outside the project before writing anything', async () => {
    const dir = await freshDir()
    const plan = planFor(dir, [file('ok.txt', 'ok\n'), file('../escape.txt', 'nope\n')])

    await expect(
      applyPlan(plan, {
        yes: true,
        force: true,
        prompter: new ScriptedPrompter([]),
        logger,
        tempRoot: stagingRoot
      })
    ).rejects.toThrow(InputError)
    await expect(stat(path.join(dir, 'ok.txt'))).rejects.toThrow()
  })
})

describe('classifyFiles', () => {
  it('marks each file as new, overwrite or keep', async () => {
    const dir = await freshDir()
    await existing(dir, 'a.txt', 'x')
    await existing(dir, 'b.txt', 'x')
    const plan = planFor(dir, [
      file('a.txt', 'y'),
      file('b.txt', 'y', { strategy: 'skip-if-exists' }),
      file('c.txt', 'y')
    ])

    const statuses = (await classifyFiles(plan)).map((entry) => [entry.file.path, entry.status])

    expect(statuses).toEqual([
      ['a.txt', 'overwrite'],
      ['b.txt', 'keep'],
      ['c.txt', 'new']
    ])
  })
})

describe('applyPlan safety', () => {
  const noPrompts = {
    yes: true,
    force: true,
    prompter: new ScriptedPrompter([]),
    logger,
    tempRoot: stagingRoot
  }

  it('refuses to write through a symlinked directory inside the project', async () => {
    const dir = await freshDir()
    const elsewhere = await freshDir()
    await symlink(elsewhere, path.join(dir, 'src'))

    await expect(applyPlan(planFor(dir, [file('src/app.ts', 'x\n')]), noPrompts)).rejects.toThrow(
      /symbolic link/
    )
    await expect(stat(path.join(elsewhere, 'app.ts'))).rejects.toThrow()
  })

  it('refuses a dangling symlink at a planned path instead of writing through it', async () => {
    const dir = await freshDir()
    const target = path.join(await freshDir(), 'not-created-yet')
    await symlink(target, path.join(dir, 'package.json'))

    await expect(
      applyPlan(planFor(dir, [file('package.json', '{}\n')]), { ...noPrompts, force: false })
    ).rejects.toThrow(/symbolic link/)
    await expect(stat(target)).rejects.toThrow()
  })

  it('refuses a directory where a file is planned, before writing anything', async () => {
    const dir = await freshDir()
    await mkdir(path.join(dir, 'README.md'))
    const plan = planFor(dir, [file('a.txt', 'a\n'), file('README.md', '# x\n')])

    await expect(applyPlan(plan, noPrompts)).rejects.toThrow(/not a regular file/)
    await expect(stat(path.join(dir, 'a.txt'))).rejects.toThrow()
  })

  it.each([
    [['b', 'a/../b'], 'the same file'],
    [['README.md', 'readme.md'], 'the same file'],
    [['./b'], 'normalised'],
    [[''], 'normalised']
  ])('rejects planned paths %j (%s)', async (paths) => {
    const dir = await freshDir()
    const plan = planFor(
      dir,
      paths.map((planned) => file(planned, 'x\n'))
    )

    await expect(applyPlan(plan, noPrompts)).rejects.toThrow(InputError)
  })

  it('backs up an overwritten file and keeps its permissions', async () => {
    const dir = await freshDir()
    await existing(dir, '.env', 'SECRET=mine\n')
    await chmod(path.join(dir, '.env'), 0o600)

    const result = await applyPlan(planFor(dir, [file('.env', 'SECRET=\n')]), noPrompts)

    expect(await read(dir, '.env')).toBe('SECRET=\n')
    expect((await stat(path.join(dir, '.env'))).mode & 0o777).toBe(0o600)
    expect(result.backupDir).toBeDefined()
    expect(await readFile(path.join(result.backupDir ?? '', '.env'), 'utf8')).toBe('SECRET=mine\n')
  })
})

describe('applyPlan cleanup (D-58)', () => {
  const noPrompts = {
    yes: true,
    force: true,
    prompter: new ScriptedPrompter([]),
    logger,
    tempRoot: stagingRoot
  }

  it('removes its own staging copy after a clean run', async () => {
    const dir = await freshDir()
    const tempRoot = await freshDir()

    await applyPlan(planFor(dir, [file('a.txt', 'a\n')]), { ...noPrompts, tempRoot })

    expect(await readdir(tempRoot)).toEqual([])
  })

  it('keeps the backups of overwritten files but drops the staged copies', async () => {
    const dir = await freshDir()
    const tempRoot = await freshDir()
    await existing(dir, 'a.txt', 'mine\n')

    const result = await applyPlan(planFor(dir, [file('a.txt', 'new\n')]), {
      ...noPrompts,
      tempRoot
    })

    const [staging] = await readdir(tempRoot)
    expect(await readdir(path.join(tempRoot, staging ?? ''))).toEqual(['backup'])
    expect(await readFile(path.join(result.backupDir ?? '', 'a.txt'), 'utf8')).toBe('mine\n')
  })
})
