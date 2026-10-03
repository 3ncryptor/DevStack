import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { runDoctor } from '../src/commands/doctor'
import { listModules } from '../src/commands/modules'
import type { Probe } from '../src/core/doctor'
import { loadModules } from '../src/core/module-loader'
import { InputError } from '../src/errors'
import { generatedProject } from './helpers/generated-project'
import { removeTempDirs } from './helpers/temp-dirs'

afterAll(removeTempDirs)

const registry = loadModules()

describe('modules list', () => {
  it('groups every module under its category, in category order', () => {
    const text = listModules(registry, {})

    expect(text.indexOf('language')).toBeLessThan(text.indexOf('framework'))
    expect(text).toMatch(/framework\n {2}framework-express +Express/)
    for (const id of registry.keys()) {
      expect(text).toContain(id)
    }
  })

  it('filters by category', () => {
    const text = listModules(registry, { category: 'framework' })

    expect(text).toContain('framework-nest')
    expect(text).not.toContain('orm-prisma')
  })

  it('prints JSON for scripts and agents', () => {
    const parsed = JSON.parse(
      listModules(registry, { category: 'database', json: true })
    ) as unknown

    expect(parsed).toContainEqual({
      id: 'database-postgres',
      title: 'PostgreSQL',
      description: expect.any(String) as string,
      category: 'database',
      provides: ['db:postgres', 'db:sql']
    })
  })

  it('rejects an unknown category and lists the valid ones', () => {
    expect(() => listModules(registry, { category: 'frameworks' })).toThrow(InputError)
    expect(() => listModules(registry, { category: 'frameworks' })).toThrow(/framework/)
  })
})

describe('doctor', () => {
  const healthy: Probe = (command, args) =>
    Promise.resolve(
      (
        {
          'npm --version': '11.6.0',
          'git --version': 'git version 2.51.0',
          'git config user.name': 'Ada',
          'git config user.email': 'ada@example.com',
          'docker info --format {{.ServerVersion}}': '28.4.0'
        } as Record<string, string>
      )[[command, ...args].join(' ')]
    )

  it('prints every check, Docker included, and exits 0 without errors', async () => {
    const lines: string[] = []

    const code = await runDoctor(healthy, (line) => lines.push(line))

    expect(code).toBe(0)
    expect(lines.join('\n')).toContain('✔ Docker: engine v28.4.0')
    expect(lines.join('\n')).toContain('! yarn: not installed')
  })

  it("reports a project's dependencies that differ from the catalog, and only those (D-93)", async () => {
    const project = await generatedProject(['framework-express', 'database-postgres', 'orm-prisma'])
    const file = path.join(project, 'package.json')
    const packageJson = JSON.parse(await readFile(file, 'utf8')) as {
      dependencies: Record<string, string>
    }
    packageJson.dependencies['@prisma/client'] = '^6.0.0'
    packageJson.dependencies['left-pad'] = '^1.3.0'
    await writeFile(file, JSON.stringify(packageJson))
    const lines: string[] = []

    const code = await runDoctor(healthy, (line) => lines.push(line), project)

    expect(code).toBe(0)
    expect(lines.join('\n')).toMatch(
      /! Catalog: 1 differ[^\n]*\n\s+@prisma\/client \^6\.0\.0 → \^7/
    )
    expect(lines.join('\n')).not.toContain('left-pad')
  })
})
