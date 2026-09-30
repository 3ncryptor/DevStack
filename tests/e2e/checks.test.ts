import { describe, expect, it } from 'vitest'

import { parseMatrix, securityHeaderProblems } from './lib/checks'

describe('securityHeaderProblems', () => {
  it('returns no problems for a helmet-hardened response', () => {
    const headers = new Headers({
      'content-security-policy': "default-src 'self'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'no-referrer'
    })

    expect(securityHeaderProblems(headers)).toEqual([])
  })

  it('reports missing security headers and a leaked x-powered-by', () => {
    const headers = new Headers({ 'x-powered-by': 'Express' })

    expect(securityHeaderProblems(headers)).toEqual([
      'missing header: content-security-policy',
      'missing header: x-content-type-options',
      'missing header: x-frame-options',
      'missing header: referrer-policy',
      'unexpected header: x-powered-by'
    ])
  })
})

describe('parseMatrix', () => {
  it('accepts entries with an id and a preset', () => {
    expect(parseMatrix([{ id: 'backend-preset', preset: 'backend' }])).toEqual([
      { id: 'backend-preset', preset: 'backend' }
    ])
  })

  it('rejects an empty matrix', () => {
    expect(() => parseMatrix([])).toThrow('non-empty array')
  })

  it('rejects entries without a preset', () => {
    expect(() => parseMatrix([{ id: 'x' }])).toThrow('entry 0')
  })

  it('rejects ids that are not safe kebab-case folder names', () => {
    expect(() => parseMatrix([{ id: '../escape', preset: 'backend' }])).toThrow('kebab-case')
  })
})
