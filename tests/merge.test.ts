import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applyPlan, classifyFiles } from '../src/core/apply/index'
import { mergeJson, mergeLines } from '../src/core/apply/merge'
import type { GenerationPlan, PlannedFile } from '../src/types/plan'
import { ConsoleLogger } from '../src/utils/logger'
import { ScriptedPrompter } from './helpers/scripted-prompter'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)
let stagingRoot = ''
beforeAll(async () => {
  stagingRoot = await tempDir('devstack-merge-staging-')
})

const options = () => ({
  yes: true,
  force: false,
  prompter: new ScriptedPrompter([]),
  logger: new ConsoleLogger({ silent: true }),
  tempRoot: stagingRoot
})

const planned = (filePath: string, content: string, strategy: PlannedFile['strategy']) => ({
  path: filePath,
  content,
  mode: 0o644,
  strategy,
  source: 'test'
})

function planIn(projectDir: string, files: PlannedFile[]): GenerationPlan {
  return {
    projectName: 'merge-test',
    projectDir,
    packageManager: 'npm',
    modules: [],
    files,
    commands: [],
    env: [],
    depth: 'wired'
  }
}

const GENERATED_PACKAGE = `${JSON.stringify(
  {
    name: 'generated',
    type: 'module',
    scripts: { dev: 'tsx watch src/index.ts', lint: 'eslint .' },
    dependencies: { express: '^5.2.1' }
  },
  null,
  2
)}\n`

describe('mergeJson (task 1.3)', () => {
  it('adds what is missing and keeps every existing value', () => {
    const result = mergeJson(
      JSON.stringify({ name: 'mine', scripts: { dev: 'node app.js', test: 'jest' } }),
      GENERATED_PACKAGE
    )

    expect(JSON.parse(result?.content ?? '')).toEqual({
      name: 'mine',
      scripts: { dev: 'node app.js', test: 'jest', lint: 'eslint .' },
      type: 'module',
      dependencies: { express: '^5.2.1' }
    })
    expect(result?.kept).toEqual(['name', 'scripts.dev'])
  })

  it('cannot merge into a file that is not a JSON object', () => {
    expect(mergeJson('{ broken', GENERATED_PACKAGE)).toBeUndefined()
    expect(mergeJson('[1, 2]', GENERATED_PACKAGE)).toBeUndefined()
  })
})

describe('mergeLines (task 1.3)', () => {
  it('appends only the missing lines, once, under a marker', () => {
    const merged = mergeLines(
      'node_modules\n.env\n',
      '# deps\nnode_modules\ndist\n.env\ncoverage\n'
    )

    expect(merged).toBe('node_modules\n.env\n\n# added by create-devstack-app\ndist\ncoverage\n')
    expect(mergeLines(merged, '# deps\nnode_modules\ndist\n.env\ncoverage\n')).toBe(merged)
  })
})

describe('applying merge strategies', () => {
  async function projectWith(files: Record<string, string>): Promise<string> {
    const dir = await tempDir('devstack-merge-')
    for (const [filePath, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, filePath)), { recursive: true })
      await writeFile(path.join(dir, filePath), content)
    }
    return dir
  }

  it('merges into an existing package.json without asking, even with --yes, and backs it up', async () => {
    const original = JSON.stringify({ name: 'mine', scripts: { dev: 'node app.js' } })
    const dir = await projectWith({ 'package.json': original })

    const result = await applyPlan(
      planIn(dir, [planned('package.json', GENERATED_PACKAGE, 'json-merge')]),
      options()
    )
    const written = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(written.scripts).toEqual({ dev: 'node app.js', lint: 'eslint .' })
    expect(result.merged).toEqual(['package.json'])
    expect(result.notes).toEqual([
      'package.json: kept your name, scripts.dev (generated values differ)'
    ])
    expect(await readFile(path.join(result.backupDir ?? '', 'package.json'), 'utf8')).toBe(original)
  })

  it('treats an unparseable package.json as a conflict, so --yes writes nothing', async () => {
    const dir = await projectWith({ 'package.json': '{ broken' })

    await expect(
      applyPlan(planIn(dir, [planned('package.json', GENERATED_PACKAGE, 'json-merge')]), options())
    ).rejects.toThrow(/already exist/)
    expect(await readFile(path.join(dir, 'package.json'), 'utf8')).toBe('{ broken')
  })

  it('reports an already-merged file as kept, so a second run changes nothing', async () => {
    const dir = await projectWith({ '.gitignore': 'node_modules\n' })
    const plan = planIn(dir, [planned('.gitignore', 'node_modules\ndist\n', 'line-merge')])

    await applyPlan(plan, options())
    const statuses = (await classifyFiles(plan)).map((entry) => entry.status)

    expect(await readFile(path.join(dir, '.gitignore'), 'utf8')).toContain('dist')
    expect(statuses).toEqual(['keep'])
  })
})
