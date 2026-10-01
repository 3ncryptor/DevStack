import assert from 'node:assert/strict'
import { test } from 'node:test'

import request from 'supertest'

import { createApp } from '../src/app.js'
import { toErrorResponse } from '../src/lib/errors.js'
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

await test('library client errors keep their 4xx status, e.g. an undecodable URL param', () => {
  // what Express throws for `/items/%E0%A4%A` on a route with a `:param`
  const error = Object.assign(new URIError("Failed to decode param '%E0%A4%A'"), { status: 400 })

  const { status, body } = toErrorResponse(error, 'test-id')

  assert.equal(status, 400)
  assert.equal(body.error.code, 'BAD_REQUEST')
})

await test('unknown routes get the error envelope with the request id', async () => {
  const response = await request(appWith()).get('/missing').set('x-request-id', 'test-id')

  assert.equal(response.status, 404)
  assert.equal(response.get('x-request-id'), 'test-id')
  assert.deepEqual(response.body as unknown, {
    error: { code: 'NOT_FOUND', message: 'Route GET /missing not found', requestId: 'test-id' }
  })
})
