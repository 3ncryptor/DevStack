import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { addModules, removeModules, type EvolveOptions } from '../src/commands/evolve'
import { appendEnv, mergeJson3, mergePnpmWorkspace } from '../src/core/evolve/merge3'
import type { Change } from '../src/core/evolve/reconcile'
import { InputError } from '../src/errors'
import type { Logger } from '../src/utils/logger'
import { generatedProject } from './helpers/generated-project'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)

const silent: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  success: () => undefined,
  debug: () => undefined
}

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false
  )

const options = (projectDir: string, extra: Partial<EvolveOptions> = {}): EvolveOptions => ({
  projectDir,
  dryRun: false,
  force: false,
  skipInstall: true,
  logger: silent,
  ...extra
})

const label = (change: Change): string =>
  `${change.kind} ${'file' in change ? change.file.path : change.path}`

const FASTIFY = [
  'language-node',
  'framework-fastify',
  'security-helmet',
  'testing-vitest',
  'quality-eslint',
  'quality-prettier'
]

describe('three-way JSON merge (task 5.6)', () => {
  const old = JSON.stringify({ dependencies: { a: '1', b: '1' }, scripts: { dev: 'x' } })
  const next = JSON.stringify({ dependencies: { a: '1', c: '1' }, scripts: { dev: 'y' } })

  it('applies what generation changed where the user kept the old value', () => {
    const disk = JSON.stringify({
      dependencies: { a: '1', b: '1', mine: '2' },
      scripts: { dev: 'x' }
    })

    expect(JSON.parse(mergeJson3(disk, old, next)?.content ?? '')).toEqual({
      dependencies: { a: '1', c: '1', mine: '2' },
      scripts: { dev: 'y' }
    })
  })

  it("keeps the user's value where both changed, and says so", () => {
    const disk = JSON.stringify({ dependencies: { a: '1', b: '9' }, scripts: { dev: 'mine' } })
    const result = mergeJson3(disk, old, next)

    expect(JSON.parse(result?.content ?? '')).toMatchObject({
      dependencies: { b: '9', c: '1' },
      scripts: { dev: 'mine' }
    })
    expect(result?.kept).toEqual(['dependencies.b', 'scripts.dev'])
  })

  it('refuses a file that is not JSON', () => {
    expect(mergeJson3('{ nope', old, next)).toBeUndefined()
  })
})

describe('appending to .env (task 5.6)', () => {
  it('adds only the missing variables, without the generated header, and never edits values', () => {
    const generated = '# Local development only\nPORT=3000\n# the cache\nREDIS_URL="redis://x"\n'
    const result = appendEnv('PORT=4000\n', generated, 'add cache-redis')

    expect(result.added).toEqual(['REDIS_URL'])
    expect(result.content).toContain('PORT=4000')
    expect(result.content).not.toContain('PORT=3000')
    expect(result.content).not.toContain('Local development only')
    expect(result.content).toContain('# the cache\nREDIS_URL="redis://x"')
  })
})

describe('pnpm build approvals (task 5.6)', () => {
  const generated =
    "allowBuilds:\n  'esbuild': true\n  'prisma': true\nonlyBuiltDependencies:\n  - 'esbuild'\n"

  it('adds the approvals a new module needs to both lists, by exact name', () => {
    const disk =
      "allowBuilds:\n  '@prisma/client': true\n  esbuild: true\nonlyBuiltDependencies:\n  - esbuild\n"
    const result = mergePnpmWorkspace(disk, generated)

    expect(result?.added).toEqual(['prisma'])
    expect(result?.content).toContain("allowBuilds:\n  'prisma': true")
    expect(result?.content).toContain("onlyBuiltDependencies:\n  - 'prisma'")
  })

  it('leaves a file it does not recognise to the user', () => {
    expect(mergePnpmWorkspace('packages: []\n', generated)).toBeUndefined()
  })
})

describe('add and remove on a generated project (tasks 5.6, 5.8)', () => {
  it('adds a module: new files, the untouched app updated, nothing else', async () => {
    const dir = await generatedProject(FASTIFY)

    const result = await addModules(['security-rate-limit'], options(dir))

    expect(result.changes.map(label)).toEqual([
      'update .devstack/stack.json',
      'update src/app.ts',
      'create src/lib/rate-limiter.ts',
      'create src/plugins/rate-limit.ts',
      'create tests/rate-limit.test.ts'
    ])
    expect(await readFile(path.join(dir, 'src/app.ts'), 'utf8')).toContain('registerRateLimit')
    expect(await readFile(path.join(dir, '.devstack/stack.json'), 'utf8')).toContain(
      'security-rate-limit'
    )
  })

  it('never overwrites an edited file: the new version goes next to it', async () => {
    const dir = await generatedProject(FASTIFY)
    const app = path.join(dir, 'src/app.ts')
    const edited = `${await readFile(app, 'utf8')}\n// mine\n`
    await writeFile(app, edited)

    const result = await addModules(['security-rate-limit'], options(dir))

    expect(await readFile(app, 'utf8')).toBe(edited)
    expect(await readFile(`${app}.devstack-new`, 'utf8')).toContain('registerRateLimit')
    expect(result.report).toContain('you edited it')
  })

  it('overwrites an edited file with --force, keeping a backup', async () => {
    const dir = await generatedProject(FASTIFY)
    const app = path.join(dir, 'src/app.ts')
    await writeFile(app, `${await readFile(app, 'utf8')}\n// mine\n`)

    const result = await addModules(['security-rate-limit'], options(dir, { force: true }))
    const backup = path.join(result.outcome?.backupDir ?? '', 'src/app.ts')

    expect(await readFile(app, 'utf8')).not.toContain('// mine')
    expect(await readFile(backup, 'utf8')).toContain('// mine')
  })

  it('writes nothing in a dry run', async () => {
    const dir = await generatedProject(FASTIFY)

    const result = await addModules(['security-rate-limit'], options(dir, { dryRun: true }))

    expect(result.changes.length).toBeGreaterThan(0)
    expect(await exists(path.join(dir, 'src/plugins/rate-limit.ts'))).toBe(false)
  })

  it('removes a module: its untouched files go, edited ones stay, the stack is updated', async () => {
    const dir = await generatedProject([...FASTIFY, 'security-rate-limit'])
    const test = path.join(dir, 'tests/rate-limit.test.ts')
    await writeFile(test, `${await readFile(test, 'utf8')}\n// mine\n`)

    const result = await removeModules(['security-rate-limit'], options(dir))

    expect(await exists(path.join(dir, 'src/plugins/rate-limit.ts'))).toBe(false)
    expect(await exists(test)).toBe(true)
    expect(result.report).toContain('you changed it; delete it yourself if unused')
    expect(await readFile(path.join(dir, 'src/app.ts'), 'utf8')).not.toContain('registerRateLimit')
    expect(result.modules).not.toContain('security-rate-limit')
  })

  it('refuses to remove a module another one requires, or one that is not there', async () => {
    const dir = await generatedProject([...FASTIFY, 'database-postgres', 'orm-prisma', 'auth-jwt'])

    await expect(removeModules(['database-postgres'], options(dir))).rejects.toThrow(
      /required by auth-jwt/
    )
    await expect(removeModules(['cache-redis'], options(dir))).rejects.toThrow(/Not in the stack/)
    await expect(addModules(['orm-prisma'], options(dir))).rejects.toThrow(/Already in the stack/)
    await expect(addModules(['no-such-module'], options(dir))).rejects.toThrow(InputError)
  })

  it('needs a DevStack project', async () => {
    const dir = await tempDir('not-a-project-')

    await expect(addModules(['cache-redis'], options(dir))).rejects.toThrow(
      /not a DevStack project/
    )
  })
})
