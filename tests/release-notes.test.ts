import { describe, expect, it } from 'vitest'

import { checkTag, releaseNotes } from '../scripts/release-notes'

const CHANGELOG = `# create-devstack-app

## 1.1.0

### Minor Changes

- Python projects.

## 1.0.0

### Major Changes

- First public release.
`

describe('release notes', () => {
  it('returns the body of the version section, up to the next one', () => {
    expect(releaseNotes(CHANGELOG, '1.1.0')).toBe('### Minor Changes\n\n- Python projects.')
    expect(releaseNotes(CHANGELOG, '1.0.0')).toBe('### Major Changes\n\n- First public release.')
  })

  it('fails for a version the changelog does not have', () => {
    expect(() => releaseNotes(CHANGELOG, '1.0')).toThrow('no "## 1.0" section')
  })

  it('fails for an empty section', () => {
    expect(() => releaseNotes('## 2.0.0\n\n## 1.0.0\n- x\n', '2.0.0')).toThrow('is empty')
  })

  it('accepts only v plus the package version as the tag', () => {
    expect(() => checkTag('v1.0.0', '1.0.0')).not.toThrow()
    expect(() => checkTag('1.0.0', '1.0.0')).toThrow('expected v1.0.0')
    expect(() => checkTag('v1.0.1', '1.0.0')).toThrow('does not match')
  })
})
