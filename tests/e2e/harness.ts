/**
 * e2e harness (buildPlan task 0.2): packs the CLI as npm would publish it, generates each
 * matrix combination, and checks that the generated project passes its own gates.
 *
 *   npx tsx tests/e2e/harness.ts [--tier smoke|full] [--pm npm|pnpm|yarn|bun|all]
 *                                [--concurrency <n>] [--only <id>] [--keep] [--report <file>]
 *
 * smoke (default): the combinations marked `smoke`, on one package manager, in parallel; fast
 * enough for every change. full: every combination, all four package managers, plus the
 * post-build lint; for nightly runs and releases.
 */
import { existsSync, rmSync } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'

import { bootAndProbe } from './lib/boot'
import { composeCheck } from './lib/compose'
import { bootFullstack } from './lib/web'
import { parseMatrix, type Combination, type ReadyExpectation } from './lib/checks'
import { killAllGroups, run } from './lib/process'

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const
type PackageManager = (typeof PACKAGE_MANAGERS)[number]

const isPackageManager = (value: string): value is PackageManager =>
  (PACKAGE_MANAGERS as readonly string[]).includes(value)

type Tier = 'smoke' | 'full'

interface HarnessArgs {
  tier: Tier
  pms: PackageManager[]
  concurrency?: number
  only?: string
  keep: boolean
  report?: string
}

interface StepResult {
  step: string
  ok: boolean
  durationMs: number
  detail: string
}

interface CombinationReport {
  id: string
  pm: PackageManager
  steps: StepResult[]
}

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const GATE_SCRIPTS = ['lint', 'format', 'typecheck', 'build'] as const
/** Run when the project has them; `bare` projects have no tests yet. */
const OPTIONAL_GATE_SCRIPTS = ['test'] as const
const REQUIRED_FILES = ['package.json', '.gitignore'] as const

/** The app to boot: apps/api in a monorepo (B8), the project itself otherwise. */
const appDirOf = (projectDir: string): string =>
  existsSync(path.join(projectDir, 'apps', 'api', 'package.json'))
    ? path.join(projectDir, 'apps', 'api')
    : projectDir
const MINUTE_MS = 60_000
const INSTALL_TIMEOUT_MS = 10 * MINUTE_MS
const STEP_TIMEOUT_MS = 5 * MINUTE_MS
const BOOT_TIMEOUT_MS = 30_000

function parseArgs(argv: string[]): HarnessArgs {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)
    return index === -1 ? undefined : argv[index + 1]
  }
  const tier = valueOf('--tier') ?? 'smoke'
  if (tier !== 'smoke' && tier !== 'full') {
    throw new Error(`--tier must be smoke or full, got "${tier}"`)
  }
  const pm = valueOf('--pm') ?? (tier === 'full' ? 'all' : 'pnpm')
  if (pm !== 'all' && !isPackageManager(pm)) {
    throw new Error(`--pm must be one of ${PACKAGE_MANAGERS.join(', ')} or all, got "${pm}"`)
  }
  const concurrency = valueOf('--concurrency')
  return {
    tier,
    pms: pm === 'all' ? [...PACKAGE_MANAGERS] : [pm],
    concurrency: concurrency === undefined ? undefined : Number.parseInt(concurrency, 10),
    only: valueOf('--only'),
    keep: argv.includes('--keep'),
    report: valueOf('--report')
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown
}

/** Builds and packs the CLI, installs the tarball, and returns the path of its bin. */
async function installPackedCli(workDir: string): Promise<string> {
  const build = await run('npm', ['run', 'build'], { cwd: REPO_ROOT, timeoutMs: STEP_TIMEOUT_MS })
  if (!build.ok) {
    throw new Error(`CLI build failed:\n${build.output}`)
  }

  const pack = await run(
    'npm',
    ['pack', '--pack-destination', workDir, '--json', '--ignore-scripts'],
    {
      cwd: REPO_ROOT,
      timeoutMs: STEP_TIMEOUT_MS
    }
  )
  if (!pack.ok) {
    throw new Error(`npm pack failed:\n${pack.output}`)
  }
  const [packed] = JSON.parse(pack.stdout) as [{ filename: string }]

  const cliDir = path.join(workDir, 'cli')
  await mkdir(cliDir)
  await writeFile(path.join(cliDir, 'package.json'), '{ "private": true }\n')
  const tarball = path.join(workDir, packed.filename)
  const install = await run('npm', ['install', tarball, '--no-audit', '--no-fund'], {
    cwd: cliDir,
    timeoutMs: INSTALL_TIMEOUT_MS
  })
  if (!install.ok) {
    throw new Error(`installing the packed CLI failed:\n${install.output}`)
  }

  const manifest = (await readJson(path.join(REPO_ROOT, 'package.json'))) as {
    bin: Record<string, string>
  }
  const [binName] = Object.keys(manifest.bin)
  return path.join(cliDir, 'node_modules', '.bin', binName)
}

function toStep(step: string, result: { ok: boolean; durationMs: number }, detail: string) {
  return { step, ok: result.ok, durationMs: result.durationMs, detail: result.ok ? '' : detail }
}

/** A preset, or an inline module list written out as a stack config and passed with --config. */
async function stackArgs(combination: Combination, projectsDir: string): Promise<string[]> {
  if (combination.preset !== undefined) {
    return ['--preset', combination.preset]
  }
  const configFile = path.join(projectsDir, `${combination.id}.stack.json`)
  const config = { version: 1, name: combination.id, modules: combination.modules }
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`)
  return ['--config', configFile]
}

async function checkCombination(
  cliBin: string,
  combination: Combination,
  pm: PackageManager,
  projectsDir: string,
  tier: Tier
): Promise<CombinationReport> {
  const steps: StepResult[] = []
  const finish =
    combination.finish === true ? await localGitHub(projectsDir, combination.id) : undefined
  const generate = await run(
    cliBin,
    [
      combination.id,
      ...(await stackArgs(combination, projectsDir)),
      ...(combination.depth === undefined ? [] : ['--depth', combination.depth]),
      '--yes',
      // the harness runs the same gates itself; only `finish` combinations pay for them twice
      ...(finish === undefined ? ['--skip-git', '--skip-verify'] : ['--github', finish.url])
    ],
    {
      cwd: projectsDir,
      timeoutMs: INSTALL_TIMEOUT_MS,
      env: { npm_config_user_agent: `${pm}/e2e`, ...(finish?.env ?? {}) }
    }
  )
  steps.push(
    toStep(
      finish === undefined ? 'generate + install' : 'generate + verify + commit + push',
      generate,
      generate.output
    )
  )
  if (generate.ok && finish !== undefined) steps.push(await pushedStep(finish.bare))
  if (!generate.ok) {
    return { id: combination.id, pm, steps }
  }

  const projectDir = path.join(projectsDir, combination.id)
  steps.push(await checkRequiredFiles(projectDir))
  steps.push(...(await runGateScripts(projectDir, pm, tier)))

  const built = steps.find((step) => step.step === 'build')?.ok === true
  if (combination.boot === false) {
    steps.push({ step: 'boot + /health (skipped: no server)', ok: true, durationMs: 0, detail: '' })
  } else if (built) {
    const startedAt = Date.now()
    const appDir = appDirOf(projectDir)
    const webDir = path.join(projectDir, 'apps', 'web')
    if (existsSync(path.join(webDir, 'package.json'))) {
      const startedAt = Date.now()
      const webApps = await Promise.all(
        ['web', 'admin']
          .map((name) => ({ name, dir: path.join(projectDir, 'apps', name) }))
          .filter((app) => existsSync(path.join(app.dir, 'package.json')))
          .map(async (app) => ({ ...app, command: await startCommand(app.dir) }))
      )
      const manifest = (await readJson(path.join(projectDir, '.devstack', 'stack.json'))) as {
        modules: Array<string | { id: string }>
      }
      const boot = await bootFullstack({
        apiDir: appDir,
        apiCommand: await startCommand(appDir),
        webApps,
        versioned: manifest.modules.some(
          (entry) => (typeof entry === 'string' ? entry : entry.id) === 'api-versioning'
        ),
        env: await bootEnv(appDir),
        timeoutMs: BOOT_TIMEOUT_MS,
        hasDatabase: existsSync(path.join(appDir, 'src', 'db', 'client.ts')),
        databaseUp: process.env.E2E_DATABASE_URL !== undefined
      })
      const detail = `${boot.problems.join('\n')}\n--- app output ---\n${boot.output}`
      steps.push(
        toStep(
          'boot web + status page',
          { ok: boot.ok, durationMs: Date.now() - startedAt },
          detail
        )
      )
    }
    const [command, ...args] = await startCommand(appDir)
    const boot = await bootAndProbe(appDir, command, args, {
      timeoutMs: BOOT_TIMEOUT_MS,
      env: await bootEnv(appDir),
      ready: readyExpectation(appDir)
    })
    const detail = `${boot.problems.join('\n')}\n--- app output ---\n${boot.output}`
    steps.push(
      toStep('boot + /health', { ok: boot.ok, durationMs: Date.now() - startedAt }, detail)
    )
  } else {
    steps.push({
      step: 'boot + /health',
      ok: false,
      durationMs: 0,
      detail: 'skipped: build failed'
    })
  }
  if (combination.compose === true && tier === 'full' && built) {
    steps.push(await composeCheck(projectDir, combination.id))
  }
  return { id: combination.id, pm, steps }
}

/**
 * The project's own `start` command, run directly. Package-manager wrappers (`npm run start`)
 * re-raise SIGTERM after their child exits, which would hide whether the app itself shut down
 * cleanly; the harness must observe the app's exit status.
 */
async function startCommand(projectDir: string): Promise<string[]> {
  const manifest = (await readJson(path.join(projectDir, 'package.json'))) as {
    scripts?: Record<string, string>
  }
  const start = manifest.scripts?.start
  if (start === undefined || !/^[\w./@=:-]+(\s+[\w./@=:-]+)*$/.test(start)) {
    throw new Error(`start script must be a plain command the harness can run directly: "${start}"`)
  }
  const [binary = '', ...args] = start.split(/\s+/)
  return [localBinary(projectDir, binary), ...args]
}

/** `next` and friends live in node_modules/.bin of the app, or of the workspace root. */
function localBinary(dir: string, binary: string): string {
  for (const candidate of [dir, path.resolve(dir, '..', '..')]) {
    const local = path.join(candidate, 'node_modules', '.bin', binary)
    if (existsSync(local)) return local
  }
  return binary
}

/**
 * The project's .env, as a deployment would provide it. E2E_DATABASE_URL points the app at a
 * real database (CI service container, or one you started yourself); otherwise none is reachable.
 */
async function bootEnv(projectDir: string): Promise<Record<string, string>> {
  const file = path.join(projectDir, '.env')
  const fromFile = existsSync(file) ? parseEnv(await readFile(file, 'utf8')) : {}
  const databaseUrl = process.env.E2E_DATABASE_URL
  return Object.fromEntries(
    Object.entries({ ...fromFile, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
}

/** With a database module and no reachable database, /ready must say so with a 503. */
function readyExpectation(projectDir: string): ReadyExpectation {
  const hasDatabase = existsSync(path.join(projectDir, 'src', 'db', 'client.ts'))
  return hasDatabase && process.env.E2E_DATABASE_URL === undefined
    ? { status: 503, failing: ['db'] }
    : { status: 200, failing: [] }
}

const INITIAL_COMMIT = 'chore: initial project setup (devstack)'

/**
 * A stand-in for GitHub: a local bare repository, reached through a throwaway git config that
 * rewrites one github.com URL to it (the CLI's URL check stays strict), plus a git identity.
 * The developer's own git config is never read or written.
 */
async function localGitHub(
  projectsDir: string,
  id: string
): Promise<{ url: string; bare: string; env: Record<string, string> }> {
  const home = path.join(projectsDir, `${id}.git-home`)
  await mkdir(home, { recursive: true })
  const bare = path.join(home, 'remote.git')
  await run('git', ['init', '--bare', '--quiet', '-b', 'main', bare], {
    cwd: home,
    timeoutMs: STEP_TIMEOUT_MS
  })
  const url = `https://github.com/devstack-e2e/${id}.git`
  const config = path.join(home, 'gitconfig')
  await writeFile(
    config,
    [
      '[user]',
      '  name = DevStack e2e',
      '  email = e2e@devstack.invalid',
      `[url "file://${bare}"]`,
      `  insteadOf = ${url}`,
      ''
    ].join('\n')
  )
  return { url, bare, env: { GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1' } }
}

/** The remote received exactly the initial commit, on main. */
async function pushedStep(bare: string): Promise<StepResult> {
  const startedAt = Date.now()
  const log = await run('git', ['--git-dir', bare, 'log', '--format=%s', 'main'], {
    cwd: path.dirname(bare),
    timeoutMs: STEP_TIMEOUT_MS
  })
  const ok = log.ok && log.stdout.trim() === INITIAL_COMMIT
  return {
    step: 'pushed initial commit',
    ok,
    durationMs: Date.now() - startedAt,
    detail: ok ? '' : `remote log: ${log.output}`
  }
}

/** Files every generated project must contain; dotfiles are the ones npm packing drops. */
async function checkRequiredFiles(projectDir: string): Promise<StepResult> {
  const missing: string[] = []
  for (const file of REQUIRED_FILES) {
    const present = await access(path.join(projectDir, file)).then(
      () => true,
      () => false
    )
    if (!present) {
      missing.push(file)
    }
  }
  // a TypeScript config, at the root or in the app of a monorepo
  if (!existsSync(path.join(appDirOf(projectDir), 'tsconfig.json'))) missing.push('tsconfig.json')
  const detail = `missing: ${missing.join(', ')}`
  return { step: 'required files', ok: missing.length === 0, durationMs: 0, detail }
}

async function runGateScripts(
  projectDir: string,
  pm: PackageManager,
  tier: Tier
): Promise<StepResult[]> {
  const manifest = (await readJson(path.join(projectDir, 'package.json'))) as {
    scripts?: Record<string, string>
  }
  const results: StepResult[] = []
  for (const script of GATE_SCRIPTS) {
    if (manifest.scripts?.[script] === undefined) {
      results.push({ step: script, ok: false, durationMs: 0, detail: 'script missing' })
      continue
    }
    const result = await run(pm, ['run', script], { cwd: projectDir, timeoutMs: STEP_TIMEOUT_MS })
    results.push(toStep(script, result, result.output))
  }
  for (const script of OPTIONAL_GATE_SCRIPTS) {
    if (manifest.scripts?.[script] === undefined) continue
    const result = await run(pm, ['run', script], { cwd: projectDir, timeoutMs: STEP_TIMEOUT_MS })
    results.push(toStep(script, result, result.output))
  }
  // a generated CI workflow must be valid for GitHub Actions before anyone pushes it
  const workflow = path.join(projectDir, '.github', 'workflows', 'ci.yml')
  if (existsSync(workflow)) {
    const result = await run('npx', ['--yes', '@action-validator/cli@0.6.0', workflow], {
      cwd: projectDir,
      timeoutMs: STEP_TIMEOUT_MS
    })
    results.push(toStep('ci workflow valid', result, result.output))
  }
  // builds write files of their own (next-env.d.ts, route types); the gates must still pass
  if (results.find((result) => result.step === 'build')?.ok === true) {
    // format catches files a build writes (next-env.d.ts); lint after build is the slow, rare one
    for (const script of tier === 'full' ? (['lint', 'format'] as const) : (['format'] as const)) {
      const result = await run(pm, ['run', script], { cwd: projectDir, timeoutMs: STEP_TIMEOUT_MS })
      results.push(toStep(`${script} (after build)`, result, result.output))
    }
  }
  return results
}

/** A harness bug in one combination must not discard the results of the others. */
async function checkCombinationSafely(
  cliBin: string,
  combination: Combination,
  pm: PackageManager,
  projectsDir: string,
  tier: Tier
): Promise<CombinationReport> {
  try {
    return await checkCombination(cliBin, combination, pm, projectsDir, tier)
  } catch (error: unknown) {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
    return {
      id: combination.id,
      pm,
      steps: [{ step: 'harness', ok: false, durationMs: 0, detail }]
    }
  }
}

/** Ctrl-C or a CI cancel skips `finally`; kill spawned process groups and remove the work dir. */
function cleanUpOnInterrupt(workDir: string, keep: boolean): void {
  const onSignal = (signal: NodeJS.Signals): void => {
    killAllGroups()
    if (!keep) {
      rmSync(workDir, { recursive: true, force: true })
    }
    process.kill(process.pid, signal)
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
}

function printReport(reports: CombinationReport[]): void {
  for (const report of reports) {
    console.log(`\n${report.id} (${report.pm})`)
    for (const step of report.steps) {
      const seconds = (step.durationMs / 1000).toFixed(1)
      console.log(`  ${step.ok ? '✔' : '✖'} ${step.step} (${seconds}s)`)
      if (!step.ok) {
        console.log(step.detail.replace(/^/gm, '      '))
      }
    }
  }
}

/** Runs `work` over `items` with at most `limit` running at once; results keep their order. */
async function inPool<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      if (item !== undefined) results[index] = await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

/** yarn classic's cache is not safe for concurrent installs; the others share theirs fine. */
const defaultConcurrency = (pm: PackageManager): number => (pm === 'yarn' ? 1 : 4)

/** Generated projects need Node 24 (D-09); yarn refuses to install them on anything older. */
function skipReason(pm: PackageManager): string | undefined {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
  return pm === 'yarn' && major < 24
    ? `yarn skipped: it needs Node 24 for generated projects (this is ${process.versions.node})`
    : undefined
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const matrix = parseMatrix(await readJson(path.join(import.meta.dirname, 'matrix.json')))
    .filter((combination) => args.tier === 'full' || combination.smoke === true)
    .filter((combination) => args.only === undefined || combination.id === args.only)
  if (matrix.length === 0) {
    throw new Error(`--only "${args.only ?? ''}" matches no ${args.tier} combination`)
  }
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'devstack-e2e-'))
  cleanUpOnInterrupt(workDir, args.keep)

  try {
    const cliBin = await installPackedCli(workDir)
    const reports: CombinationReport[] = []
    for (const pm of args.pms) {
      const skipped = skipReason(pm)
      if (skipped !== undefined) {
        console.log(skipped)
        continue
      }
      const projectsDir = path.join(workDir, 'projects', pm)
      await mkdir(projectsDir, { recursive: true })
      const startedAt = Date.now()
      reports.push(
        ...(await inPool(
          matrix,
          args.concurrency ?? defaultConcurrency(pm),
          async (combination) => {
            const report = await checkCombinationSafely(
              cliBin,
              combination,
              pm,
              projectsDir,
              args.tier
            )
            const ok = report.steps.every((step) => step.ok)
            console.log(`${ok ? '✔' : '✖'} ${combination.id} (${pm})`)
            return report
          }
        ))
      )
      console.log(
        `${pm}: ${matrix.length} combinations in ${Math.round((Date.now() - startedAt) / 1000)}s`
      )
    }

    printReport(reports)
    if (args.report !== undefined) {
      await writeFile(args.report, `${JSON.stringify(reports, null, 2)}\n`)
    }
    const failed =
      reports.length === 0 || reports.some((report) => report.steps.some((step) => !step.ok))
    process.exitCode = failed ? 1 : 0
  } finally {
    if (args.keep) {
      console.log(`\nkept work dir: ${workDir}`)
    } else {
      await rm(workDir, { recursive: true, force: true })
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
