import 'reflect-metadata'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'

import { EnvelopeInterceptor, RawResponse } from '../src/interceptors/envelope.interceptor.js'
import { ApiSuccess } from '../src/lib/api-response.js'

// handlers are only looked up for their metadata, never called, so they take no `this`
class Routes {
  wrapped(this: void): void {}

  @RawResponse()
  raw(this: void): void {}
}

/** The parts of an ExecutionContext the interceptor reads. */
const contextFor = (handler: () => void): ExecutionContext =>
  ({ getHandler: () => handler, getClass: () => Routes }) as unknown as ExecutionContext

const intercept = (handler: () => void, value: unknown): Promise<unknown> =>
  lastValueFrom(
    new EnvelopeInterceptor(new Reflector()).intercept(contextFor(handler), {
      handle: () => of(value)
    })
  )

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

await test('wraps a returned value as { success: true, data }', async () => {
  const body = await intercept(Routes.prototype.wrapped, { id: 1 })

  assert.deepEqual(json(body), { success: true, data: { id: 1 } })
})

await test('keeps an ApiSuccess the handler built, with its meta', async () => {
  const body = await intercept(
    Routes.prototype.wrapped,
    ApiSuccess.paginated([1, 2], { total: 5, page: 1, limit: 2 })
  )

  assert.deepEqual(json(body), {
    success: true,
    data: [1, 2],
    meta: { total: 5, page: 1, limit: 2, pages: 3 }
  })
})

await test('leaves @RawResponse() routes unwrapped', async () => {
  const body = await intercept(Routes.prototype.raw, { status: 'ok' })

  assert.deepEqual(body, { status: 'ok' })
})
