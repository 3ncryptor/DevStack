import { describe, expect, it } from 'vitest'

import { Aborted, ApplyError, exitCodeFor, InputError, ResolutionError } from '../src/errors'

describe('exitCodeFor', () => {
  it('maps each error class to its documented exit code', () => {
    expect(exitCodeFor(new InputError('bad name'))).toBe(2)
    expect(exitCodeFor(new ResolutionError('conflict'))).toBe(2)
    expect(exitCodeFor(new ApplyError('install failed'))).toBe(1)
    expect(exitCodeFor(new Aborted())).toBe(3)
  })

  it('treats unknown errors as failures after writes', () => {
    expect(exitCodeFor(new Error('bug'))).toBe(1)
    expect(exitCodeFor('not an error')).toBe(1)
  })

  it('names errors after their class for readable output', () => {
    expect(new ResolutionError('x').name).toBe('ResolutionError')
  })
})
