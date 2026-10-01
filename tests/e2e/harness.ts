/**
 * e2e harness (buildPlan task 0.2): packs the CLI as npm would publish it, generates each
 * matrix combination, and checks that the generated project passes its own gates.
 *
 *   npx tsx tests/e2e/harness.ts [--pm npm|pnpm] [--only <id>] [--keep] [--report <file>]
 */
import { rmSync } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { bootAndProbe } from './lib/boot'
import { parseMatrix, type Combination } from './lib/checks'
import { killAllGroups, run } from './lib/process'

type PackageManager = 'npm' | 'pnpm'

interface HarnessArgs {
  pm: PackageManager
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
const REQUIRED_FILES = ['package.json', '.gitignore', 'tsconfig.json'] as const
const MINUTE_MS = 60_000
const INSTALL_TIMEOUT_MS = 10 * MINUTE_MS
const STEP_TIMEOUT_MS = 5 * MINUTE_MS
const BOOT_TIMEOUT_MS = 30_000

function parseArgs(argv: string[]): HarnessArgs {
  const valueOf = (flag: string): string | undefined => {
    const index = argv.indexOf(flag)
    return index === -1 ? undefined : argv[index + 1]
  }
  const pm = valueOf('--pm') ?? 'npm'
  if (pm !== 'npm' && pm !== 'pnpm') {
    throw new Error(`--pm must be npm or pnpm, got "${pm}"`)
  }
  return { pm, only: valueOf('--only'), keep: argv.includes('--keep'), report: valueOf('--report') }
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
  projectsDir: string
): Promise<CombinationReport> {
  const steps: StepResult[] = []
  const generate = await run(
    cliBin,
    [
      combination.id,
      ...(await stackArgs(combination, projectsDir)),
      ...(combination.depth === undefined ? [] : ['--depth', combination.depth]),
      '--yes',
      '--skip-git'
    ],
    { cwd: projectsDir, timeoutMs: INSTALL_TIMEOUT_MS, env: { npm_config_user_agent: `${pm}/e2e` } }
  )
  steps.push(toStep('generate + install', generate, generate.output))
  if (!generate.ok) {
    return { id: combination.id, pm, steps }
  }

  const projectDir = path.join(projectsDir, combination.id)
  steps.push(await checkRequiredFiles(projectDir))
  steps.push(...(await runGateScripts(projectDir, pm)))

  const built = steps.find((step) => step.step === 'build')?.ok === true
  if (combination.boot === false) {
    steps.push({ step: 'boot + /health (skipped: no server)', ok: true, durationMs: 0, detail: '' })
  } else if (built) {
    const startedAt = Date.now()
    const [command, ...args] = await startCommand(projectDir)
    const boot = await bootAndProbe(projectDir, command, args, BOOT_TIMEOUT_MS)
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
  return start.split(/\s+/)
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
  const detail = `missing: ${missing.join(', ')}`
  return { step: 'required files', ok: missing.length === 0, durationMs: 0, detail }
}

async function runGateScripts(projectDir: string, pm: PackageManager): Promise<StepResult[]> {
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
  return results
}

/** A harness bug in one combination must not discard the results of the others. */
async function checkCombinationSafely(
  cliBin: string,
  combination: Combination,
  pm: PackageManager,
  projectsDir: string
): Promise<CombinationReport> {
  try {
    return await checkCombination(cliBin, combination, pm, projectsDir)
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const matrix = parseMatrix(await readJson(path.join(import.meta.dirname, 'matrix.json'))).filter(
    (combination) => args.only === undefined || combination.id === args.only
  )
  if (matrix.length === 0) {
    throw new Error(`--only "${args.only ?? ''}" matches no combination in matrix.json`)
  }
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'devstack-e2e-'))
  cleanUpOnInterrupt(workDir, args.keep)

  try {
    const cliBin = await installPackedCli(workDir)
    const projectsDir = path.join(workDir, 'projects')
    await mkdir(projectsDir)

    const reports: CombinationReport[] = []
    for (const combination of matrix) {
      reports.push(await checkCombinationSafely(cliBin, combination, args.pm, projectsDir))
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
