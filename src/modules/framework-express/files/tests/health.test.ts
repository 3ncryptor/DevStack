import assert from 'node:assert/strict'
import { test } from 'node:test'

import request from 'supertest'

import { createApp } from '../src/app.js'
import { createLogger } from '../src/lib/logger.js'
import type { ReadinessCheck } from '../src/lib/readiness.js'

const logger = createLogger('silent')

const appWith = (readinessChecks: readonly ReadinessCheck[] = []) =>
  createApp({ logger, readinessChecks })

await test('GET /health reports the process is alive', async () => {
  const response = await request(appWith()).get('/health')

  assert.equal(response.status, 200)
  assert.equal((response.body as { status: string }).status, 'ok')
})

await test('GET /ready is 200 when every check passes', async () => {
  const healthy: ReadinessCheck = { name: 'db', check: () => Promise.resolve() }

  const response = await request(appWith([healthy])).get('/ready')

  assert.equal(response.status, 200)
  assert.deepEqual(response.body as unknown, { status: 'ok', checks: { db: 'ok' } })
})

await test('GET /ready is 503 with per-check status when a check fails', async () => {
  const failing: ReadinessCheck = { name: 'db', check: () => Promise.reject(new Error('down')) }

  const response = await request(appWith([failing])).get('/ready')

  assert.equal(response.status, 503)
  assert.deepEqual(response.body as unknown, { status: 'error', checks: { db: 'error' } })
})

await test('unknown routes get the error envelope with the request id', async () => {
  const response = await request(appWith()).get('/missing').set('x-request-id', 'test-id')

  assert.equal(response.status, 404)
  assert.equal(response.get('x-request-id'), 'test-id')
  assert.deepEqual(response.body as unknown, {
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route GET /missing not found', requestId: 'test-id' }
  })
})
