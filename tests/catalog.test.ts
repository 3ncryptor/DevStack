import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { NODE_CATALOG, buildApprovalsFor } from '../src/catalog/node'
import { TYPE_PAIRS } from '../src/catalog/pairs'
import { BUILTIN_MODULES } from '../src/modules/index'
import { PACKAGE_ROOT } from '../src/paths'

function major(range: string): number {
  const match = /(\d+)\./.exec(range)
  if (match?.[1] === undefined) {
    throw new Error(`cannot read a major version from "${range}"`)
  }
  return Number(match[1])
}

describe('version catalog', () => {
  it('pins every runtime package and its @types package to the same major', () => {
    const mismatched = TYPE_PAIRS.filter(
      ([runtime, types]) =>
        major(NODE_CATALOG[runtime].version) !== major(NODE_CATALOG[types].version)
    )

    expect(mismatched).toEqual([])
  })

  it('reports the packages whose install scripts pnpm must be allowed to run', () => {
    expect(buildApprovalsFor(['prisma', 'tsx', 'express'])).toEqual([
      '@prisma/engines',
      'esbuild',
      'prisma'
    ])
  })
})

describe('module contract', () => {
  it('references only catalog packages', () => {
    const unknown = BUILTIN_MODULES.flatMap((moduleDefinition) =>
      [...(moduleDefinition.dependencies ?? []), ...(moduleDefinition.devDependencies ?? [])]
        .filter((name) => !(name in NODE_CATALOG))
        .map((name) => `${moduleDefinition.name}: ${name}`)
    )

    expect(unknown).toEqual([])
  })

  it('never hardcodes a version in a module definition (D-08)', () => {
    const literalVersion = /['"][\^~]?\d+\.\d+(\.\d+)?['"]/
    const offenders = BUILTIN_MODULES.map((moduleDefinition) => moduleDefinition.name).filter(
      (id) => {
        const source = readFileSync(
          path.join(PACKAGE_ROOT, 'src', 'modules', id, 'index.ts'),
          'utf8'
        )
        return literalVersion.test(source)
      }
    )

    expect(offenders).toEqual([])
  })
})
