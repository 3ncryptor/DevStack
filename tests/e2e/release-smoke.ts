/**
 * Release smoke test (buildPlan R.4): starts the CLI the ways a user would, each with empty
 * caches, from the tarball this checkout packs or, after a publish, from the registry.
 *
 *   npx tsx tests/e2e/release-smoke.ts                                   # pack this checkout
 *   npx tsx tests/e2e/release-smoke.ts --registry create-devstack-app@next
 *
 * Generated projects passing their gates is the harness's job (`npm run e2e`); this covers the
 * entry points: npx, pnpm dlx, bunx, the `create` forms (registry only, they resolve by name),
 * both bins once installed, the MCP server answering over stdio, and the bundled notices.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'

import { killAllGroups, run } from './lib/process'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const PACKAGE = 'create-devstack-app'
const BINS = [PACKAGE, 'devstack'] as const
const STEP_TIMEOUT_MS = 180_000
const MCP_TIMEOUT_MS = 20_000

interface Check {
  readonly name: string
  readonly command: string
  readonly args: readonly string[]
}

/** Where the CLI comes from; the `create` forms exist only for a published package. */
interface Source {
  readonly spec: string
  readonly version: string
  readonly isPublished: boolean
}

const launchers = ({ spec, isPublished }: Source, workDir: string): Check[] => {
  const initializer = spec.replace(PACKAGE, 'devstack-app')
  // pnpm's own caches, as --config flags: npm warns about pnpm-only npm_config_* variables
  const pnpm = [
    `--config.store-dir=${path.join(workDir, 'pnpm-store')}`,
    `--config.cache-dir=${path.join(workDir, 'pnpm-cache')}`
  ]
  const always: Check[] = [
    { name: 'npx', command: 'npx', args: ['--yes', `--package=${spec}`, PACKAGE, '--version'] },
    {
      name: 'pnpm dlx',
      command: 'pnpm',
      args: [...pnpm, `--package=${spec}`, 'dlx', PACKAGE, '--version']
    },
    { name: 'bunx', command: 'bunx', args: ['--package', spec, PACKAGE, '--version'] }
  ]
  // `yarn create` (yarn 1) installs globally, so it is left to a manual check.
  const published: Check[] = [
    {
      name: 'npm create',
      command: 'npm',
      args: ['create', '--yes', initializer, '--', '--version']
    },
    { name: 'pnpm create', command: 'pnpm', args: [...pnpm, 'create', initializer, '--version'] },
    { name: 'bun create', command: 'bun', args: ['create', initializer, '--version'] }
  ]
  return isPublished ? [...always, ...published] : always
}

async function packedSource(workDir: string): Promise<Source> {
  // Built first and packed without scripts, as the harness does, so stdout is only the JSON
  const build = await run('npm', ['run', 'build'], { cwd: REPO_ROOT, timeoutMs: STEP_TIMEOUT_MS })
  if (!build.ok) throw new Error(`CLI build failed:\n${build.output}`)
  const pack = await run(
    'npm',
    ['pack', '--pack-destination', workDir, '--json', '--ignore-scripts'],
    { cwd: REPO_ROOT, timeoutMs: STEP_TIMEOUT_MS }
  )
  if (!pack.ok) throw new Error(`npm pack failed:\n${pack.output}`)
  const [packed] = JSON.parse(pack.stdout) as [{ filename: string; version: string }]
  return { spec: path.join(workDir, packed.filename), version: packed.version, isPublished: false }
}

async function registrySource(spec: string, cwd: string): Promise<Source> {
  const view = await run('npm', ['view', spec, 'version'], { cwd, timeoutMs: STEP_TIMEOUT_MS })
  if (!view.ok) throw new Error(`npm view ${spec} failed:\n${view.output}`)
  return { spec, version: view.stdout.trim(), isPublished: true }
}

/** Sends MCP's `initialize` over stdio and waits for the server to name itself. */
function mcpAnswers(bin: string, cwd: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, ['mcp'], { cwd, env, stdio: ['pipe', 'pipe', 'ignore'] })
    const finish = (answered: boolean): void => {
      clearTimeout(timer)
      child.kill()
      resolve(answered)
    }
    const timer = setTimeout(() => finish(false), MCP_TIMEOUT_MS)
    createInterface({ input: child.stdout }).on('line', (line) => {
      // stdout is the protocol channel: anything that is not JSON-RPC there breaks clients
      let message: { id?: number; result?: { serverInfo?: { name?: string } } }
      try {
        message = JSON.parse(line) as typeof message
      } catch {
        finish(false)
        return
      }
      if (message.id === 1) finish(message.result?.serverInfo?.name === 'devstack')
    })
    child.on('error', () => finish(false))
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'release-smoke', version: '1' }
        }
      })}\n`
    )
  })
}

async function main(): Promise<void> {
  const registryIndex = process.argv.indexOf('--registry')
  const registrySpec = registryIndex === -1 ? undefined : process.argv[registryIndex + 1]
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'devstack-release-'))
  // Empty caches, so nothing resolves from an earlier install on this machine.
  const env: NodeJS.ProcessEnv = {
    npm_config_cache: path.join(workDir, 'npm-cache'),
    BUN_INSTALL_CACHE_DIR: path.join(workDir, 'bun-cache')
  }
  const results: { name: string; ok: boolean }[] = []
  const record = (name: string, ok: boolean, detail = ''): void => {
    results.push({ name, ok })
    console.log(`${ok ? '✓' : '✗'} ${name}${ok || detail === '' ? '' : `\n${detail}`}`)
  }
  const runIn = (cwd: string, command: string, args: readonly string[]) =>
    run(command, [...args], { cwd, timeoutMs: STEP_TIMEOUT_MS, env })

  try {
    const source =
      registrySpec === undefined
        ? await packedSource(workDir)
        : await registrySource(registrySpec, workDir)
    console.log(`${source.spec} (${source.version})`)

    for (const check of launchers(source, workDir)) {
      const result = await runIn(workDir, check.command, check.args)
      const printed = result.stdout.trim().split('\n').at(-1)
      record(check.name, result.ok && printed === source.version, result.output)
    }

    const project = path.join(workDir, 'installed')
    await mkdir(project)
    await writeFile(path.join(project, 'package.json'), '{ "private": true }\n')
    const install = await runIn(project, 'npm', ['install', source.spec, '--no-audit', '--no-fund'])
    record('npm install', install.ok, install.output)
    // without an install the checks below cannot run; the failure is already recorded
    if (install.ok) {
      const binPath = (bin: string): string => path.join(project, 'node_modules', '.bin', bin)
      for (const bin of BINS) {
        const result = await runIn(project, binPath(bin), ['--version'])
        record(`bin ${bin}`, result.ok && result.stdout.trim() === source.version, result.output)
      }
      const installed = path.join(project, 'node_modules', PACKAGE)
      const notices = path.join(installed, 'dist', 'THIRD_PARTY_NOTICES.md')
      record('third-party notices', existsSync(notices))
      const manifest = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>
      }
      record('no install scripts', manifest.scripts?.postinstall === undefined)
      const answered = await mcpAnswers(binPath('devstack'), project, { ...process.env, ...env })
      record('mcp over stdio', answered)
    }
  } finally {
    killAllGroups()
    if (!process.argv.includes('--keep')) await rm(workDir, { recursive: true, force: true })
  }

  const failed = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exitCode = 1
}

await main()
