import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ApiSuccess } from '../src/lib/api-response.js'
import { NotFoundError, toErrorResponse, ValidationError } from '../src/lib/errors.js'

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

await test('a success body is { success: true, data } with optional meta', () => {
  assert.deepEqual(json(new ApiSuccess({ id: 1 })), { success: true, data: { id: 1 } })
  assert.deepEqual(json(ApiSuccess.paginated(['a'], { total: 41, page: 3, limit: 20 })), {
    success: true,
    data: ['a'],
    meta: { total: 41, page: 3, limit: 20, pages: 3 }
  })
})

await test('an ApiError becomes { success: false, error } with its status', () => {
  const response = toErrorResponse(new ValidationError('Bad input', [{ path: 'email' }]), 'r-1')

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Bad input',
      requestId: 'r-1',
      details: [{ path: 'email' }]
    }
  })
  assert.equal(toErrorResponse(new NotFoundError(), 'r-2').status, 404)
})

await test('unexpected errors are a generic 500 that never shows their message', () => {
  const response = toErrorResponse(new Error('connection string: postgres://secret'), 'r-3')

  assert.equal(response.status, 500)
  assert.equal(response.body.error.message, 'Something went wrong')
})

await test('library client errors keep their 4xx status, e.g. an undecodable URL param', () => {
  // what Express throws for `/items/%E0%A4%A` on a route with a `:param`
  const error = Object.assign(new URIError("Failed to decode param '%E0%A4%A'"), { status: 400 })

  assert.equal(toErrorResponse(error, 'r-4').status, 400)
})
