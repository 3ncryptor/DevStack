import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { projectDirectoryName, projectNameProblem, resolveInside } from '../src/core/project-name'
import { InputError } from '../src/errors'

describe('projectNameProblem', () => {
  it.each(['my-app', 'api2', 'my.app', 'my_app', '@acme/api'])('accepts %s', (name) => {
    expect(projectNameProblem(name)).toBeUndefined()
  })

  it.each([
    ['', 'empty'],
    ['.', 'current directory'],
    ['..', 'parent directory'],
    ['../escape', 'path traversal'],
    ['/abs', 'absolute path'],
    ['a/b', 'nested path'],
    ['.hidden', 'leading dot'],
    ['_private', 'leading underscore'],
    ['My-App', 'uppercase'],
    ['my app', 'space'],
    ['app!', 'special character'],
    ['node_modules', 'reserved name'],
    ['http', 'Node core module'],
    ['a'.repeat(215), 'too long'],
    ['@x/node_modules', 'scoped name whose folder is reserved'],
    ['con', 'Windows device name']
  ])('rejects %j (%s)', (name) => {
    expect(projectNameProblem(name)).toBeTypeOf('string')
  })
})

describe('projectDirectoryName', () => {
  it('uses the package part of a scoped name as the folder', () => {
    expect(projectDirectoryName('@acme/api')).toBe('api')
    expect(projectDirectoryName('my-app')).toBe('my-app')
  })
})

describe('resolveInside', () => {
  const base = path.resolve('/work/project')

  it('resolves a relative path inside the base directory', () => {
    expect(resolveInside(base, 'src/app.ts')).toBe(path.join(base, 'src', 'app.ts'))
  })

  it('accepts a file whose name only starts with two dots', () => {
    expect(resolveInside(base, '..notes.json')).toBe(path.join(base, '..notes.json'))
  })

  it.each(['../outside', '../../etc/passwd', '/etc/passwd', 'src/../../x'])(
    'rejects %s, which escapes the base directory',
    (relative) => {
      expect(() => resolveInside(base, relative)).toThrow(InputError)
    }
  )
})
