import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PACKAGE_ROOT } from '../src/paths'

const SOURCE = /^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm

/** Every source file reachable from `entry` through relative imports, with its other imports. */
function importGraph(entry: string): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  const visit = (file: string): void => {
    if (graph.has(file)) return
    const specifiers = [...readFileSync(file, 'utf8').matchAll(SOURCE)].map(
      (match) => match[1] ?? ''
    )
    graph.set(
      file,
      specifiers.filter((specifier) => !specifier.startsWith('.'))
    )
    for (const specifier of specifiers.filter((candidate) => candidate.startsWith('.'))) {
      const base = path.resolve(path.dirname(file), specifier)
      const resolved = [`${base}.ts`, path.join(base, 'index.ts')].find((candidate) =>
        existsSync(candidate)
      )
      if (resolved === undefined) throw new Error(`${file}: cannot resolve ${specifier}`)
      visit(resolved)
    }
  }
  visit(entry)
  return graph
}

describe('browser entry (D-99)', () => {
  it('reaches no Node built-in, so the website can bundle it', () => {
    const graph = importGraph(path.join(PACKAGE_ROOT, 'src', 'browser.ts'))
    const nodeImports = [...graph].flatMap(([file, packages]) =>
      packages
        .filter((name) => name.startsWith('node:'))
        .map((name) => `${path.relative(PACKAGE_ROOT, file)} imports ${name}`)
    )

    expect(graph.size).toBeGreaterThan(5)
    expect(nodeImports).toEqual([])
  })
})
