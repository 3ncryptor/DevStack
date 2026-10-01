import { randomBytes } from 'node:crypto'

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
  const ports = {
    API_PORT: String(await findFreePort()),
    WEB_PORT: String(await findFreePort()),
    ADMIN_PORT: String(await findFreePort()),
    POSTGRES_PORT: String(await findFreePort())
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

    const html = await fetch(`http://127.0.0.1:${ports.WEB_PORT}/`, {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
    }).then(
      (response) => response.text(),
      (error: unknown) => `request failed: ${String(error)}`
    )
    const line = /data-testid="status"[^>]*>([^<]*)</.exec(html)?.[1] ?? ''
    const ok = line.includes('API ✓ connected') && line.includes('DB ✓ connected')
    return {
      step,
      ok,
      durationMs: Date.now() - startedAt,
      detail: ok ? '' : `status page says "${line}"`
    }
  } finally {
    // this compose project only: its containers, network, the images it built, its volume
    await run('docker', ['compose', '-p', name, 'down', '--rmi', 'local', '--volumes'], options)
  }
}
