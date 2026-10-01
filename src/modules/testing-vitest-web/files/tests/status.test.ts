import { afterEach, expect, test, vi } from 'vitest'

import { getStatus } from '../lib/status'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reports the API as connected with each readiness check', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ status: 'ok', checks: { db: 'ok' } })))
  )

  await expect(getStatus()).resolves.toEqual({ api: true, checks: { db: 'ok' } })
})

test('reports a failing dependency without hiding that the API answered', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(Response.json({ status: 'error', checks: { db: 'error' } }, { status: 503 }))
    )
  )

  await expect(getStatus()).resolves.toEqual({ api: true, checks: { db: 'error' } })
})

test('reports the API as unreachable when the request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED')))
  )

  await expect(getStatus()).resolves.toEqual({ api: false, checks: {} })
})
