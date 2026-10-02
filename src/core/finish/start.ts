import { spawn } from 'node:child_process'
import path from 'node:path'

import { execa } from 'execa'

import { packageManagerAdapter } from '../../adapters/package-manager/index'
import type { GenerationPlan } from '../../types/plan'
import type { Logger } from '../../utils/logger'
import { plannedScripts } from './verify'

const OPEN_WAIT_MS = 60_000
const POLL_INTERVAL_MS = 500

/** The page worth opening: the status page of a web app, the API docs, or /health. */
export function startUrl(plan: GenerationPlan): string {
  const web = ['framework-nextjs', 'framework-react-vite']
  if (web.some((id) => plan.modules.includes(id))) return 'http://localhost:3000/'
  const port = plan.modules.includes('layout-monorepo') ? 3001 : 3000
  return plan.modules.includes('api-docs-scalar')
    ? `http://localhost:${port}/docs`
    : `http://localhost:${port}/health`
}

const OPENERS: Partial<Record<NodeJS.Platform, readonly [string, ...string[]]>> = {
  darwin: ['open'],
  linux: ['xdg-open'],
  win32: ['cmd', '/c', 'start', '""']
}

/** Opens the URL once it answers; if that cannot happen, the summary line already shows it. */
async function openWhenUp(url: string, logger: Logger): Promise<void> {
  const deadline = Date.now() + OPEN_WAIT_MS
  while (Date.now() < deadline) {
    const up = await fetch(url, { signal: AbortSignal.timeout(2000) }).then(
      (response) => response.status < 500,
      () => false
    )
    if (up) break
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  const opener = OPENERS[process.platform]
  if (opener === undefined) return
  const [command, ...args] = opener
  const child = spawn(command, [...args, url], { detached: true, stdio: 'ignore' })
  child.once('error', () => {
    logger.warn(`Could not open a browser; visit ${url}`)
  })
  child.unref()
}

/** "Start it now?" (A0.4 step 7): data services, then the dev servers, in the foreground. */
export async function startProject(plan: GenerationPlan, logger: Logger): Promise<void> {
  const pm = packageManagerAdapter(plan.packageManager)
  const dbDir = ['', 'apps/api'].find((dir) => plannedScripts(plan, dir)['db:up'] !== undefined)
  if (dbDir !== undefined) {
    logger.info('Starting the database (db:up)...')
    const database = await execa(plan.packageManager, pm.run('db:up'), {
      cwd: path.join(plan.projectDir, dbDir),
      stdio: 'inherit',
      reject: false
    })
    if (database.exitCode !== 0) {
      logger.warn('The database did not start (is Docker running?); the app starts anyway.')
    }
  }
  const url = startUrl(plan)
  logger.info(`Starting ${plan.projectName} at ${url} (Ctrl-C stops it)`)
  void openWhenUp(url, logger)
  await execa(plan.packageManager, pm.run('dev'), {
    cwd: plan.projectDir,
    stdio: 'inherit',
    reject: false
  })
}
