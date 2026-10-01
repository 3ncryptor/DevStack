import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { test } from 'node:test'

import request from 'supertest'

import { createApp } from '../src/app.js'
import { createLogger } from '../src/lib/logger.js'
import type { ReadinessCheck } from '../src/lib/readiness.js'

const logger = createLogger('silent')

/** Starts the app without listening on a port, runs the requests, then closes it. */
async function withApp(
  readinessChecks: readonly ReadinessCheck[],
  run: (server: Server) => Promise<void>
): Promise<void> {
  const app = await createApp({ logger, readinessChecks })
  await app.init()
  try {
    await run(app.getHttpServer())
  } finally {
    await app.close()
  }
}

await test('GET /health reports the process is alive', () =>
  withApp([], async (server) => {
    const response = await request(server).get('/health')

    assert.equal(response.status, 200)
    assert.equal((response.body as { status: string }).status, 'ok')
  }))

await test('GET /ready is 503 with per-check status when a check fails', () =>
  withApp([{ name: 'db', check: () => Promise.reject(new Error('down')) }], async (server) => {
    const response = await request(server).get('/ready')

    assert.equal(response.status, 503)
    assert.deepEqual(response.body as unknown, { status: 'error', checks: { db: 'error' } })
  }))

await test('unknown routes get the error envelope with the request id', () =>
  withApp([], async (server) => {
    const response = await request(server).get('/missing').set('x-request-id', 'test-id')
    const body = response.body as { success: boolean; error: { code: string; requestId: string } }

    assert.equal(response.status, 404)
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'NOT_FOUND')
    assert.equal(body.error.requestId, 'test-id')
  }))
