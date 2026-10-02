import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { findFreePort } from './boot'
import { run } from './process'

const COMPOSE_TIMEOUT_MS = 20 * 60_000
const STATUS_TIMEOUT_MS = 10_000

export interface ComposeResult {
  step: string
  ok: boolean
  durationMs: number
  detail: string
}

/**
 * D-41 / M2 gate: `docker compose up` runs the whole stack and the status page shows the API and
 * the database connected. The compose project gets a unique name and free host ports, and only
 * what it created (its containers, network, built images and volume) is removed afterwards.
 */
export async function composeCheck(projectDir: string, id: string): Promise<ComposeResult> {
  const startedAt = Date.now()
  const step = 'docker compose up + status page'
  const docker = await run('docker', ['info', '--format', '{{.ServerVersion}}'], {
    cwd: projectDir,
    timeoutMs: STATUS_TIMEOUT_MS
  })
  if (!docker.ok) {
    return { step: `${step} (skipped: Docker is not running)`, ok: true, durationMs: 0, detail: '' }
  }

  const name = `devstack-e2e-${id}-${randomBytes(3).toString('hex')}`
  // every host port free: a developer's own databases on the default ports are never in the way
  const ports = {
    PORT: String(await findFreePort()),
    API_PORT: String(await findFreePort()),
    WEB_PORT: String(await findFreePort()),
    ADMIN_PORT: String(await findFreePort()),
    POSTGRES_PORT: String(await findFreePort()),
    MYSQL_PORT: String(await findFreePort()),
    MONGO_PORT: String(await findFreePort()),
    REDIS_PORT: String(await findFreePort())
  }
  const options = { cwd: projectDir, timeoutMs: COMPOSE_TIMEOUT_MS, env: ports }
  try {
    // --wait returns once every service reports healthy
    const up = await run(
      'docker',
      ['compose', '-p', name, 'up', '--build', '--detach', '--wait'],
      options
    )
    if (!up.ok) return { step, ok: false, durationMs: Date.now() - startedAt, detail: up.output }

    const problem = existsSync(path.join(projectDir, 'apps', 'web'))
      ? await webProblem(ports.WEB_PORT)
      : await readyProblem(`http://127.0.0.1:${ports.PORT}/ready`)
    return { step, ok: problem === '', durationMs: Date.now() - startedAt, detail: problem }
  } finally {
    // this compose project only: its containers, network, the images it built, its volume
    await run('docker', ['compose', '-p', name, 'down', '--rmi', 'local', '--volumes'], options)
  }
}

const fetchText = (url: string): Promise<string> =>
  fetch(url, { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) }).then(
    (response) => response.text(),
    (error: unknown) => `request failed: ${String(error)}`
  )

/** GET /ready answers ok: every service the app needs (database, Redis) is connected. */
async function readyProblem(url: string): Promise<string> {
  const text = await fetchText(url)
  return text.includes('"status":"ok"') ? '' : `${url} answered ${text}`
}

/**
 * The web app shows the API and the database connected: in the server-rendered status line
 * (Next.js), or, for a single-page app, through its /api proxy.
 */
async function webProblem(webPort: string): Promise<string> {
  const html = await fetchText(`http://127.0.0.1:${webPort}/`)
  if (html.includes('<div id="root">')) {
    return readyProblem(`http://127.0.0.1:${webPort}/api/ready`)
  }
  const line = /data-testid="status"[^>]*>([^<]*)</.exec(html)?.[1] ?? ''
  return line.includes('API ✓ connected') && line.includes('DB ✓ connected')
    ? ''
    : `status page says "${line}"`
}
