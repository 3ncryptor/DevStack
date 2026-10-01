import { describe, expect, it } from 'vitest'

import { MANIFEST_PATH, parseStackConfig, splitModuleEntries } from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan, type PlanInput } from '../src/core/planner/index'
import { InputError } from '../src/errors'
import type { GenerationPlan } from '../src/types/plan'

const MODULES = ['framework-express', 'security-rate-limit']

function plan(
  moduleOptions: Record<string, unknown> = {},
  modules = MODULES
): Promise<GenerationPlan> {
  const input: PlanInput = {
    projectName: 'opts-app',
    projectDir: '/virtual/opts-app',
    selectedModuleNames: modules,
    moduleOptions,
    registry: loadModules(),
    packageManager: 'npm',
    options: { skipInstall: false, skipGit: false }
  }
  return buildGenerationPlan(input)
}

const rateLimiter = (result: GenerationPlan): string =>
  result.files.find((file) => file.path === 'src/middlewares/rate-limit.ts')?.content ?? ''

describe('module options (task 1.6)', () => {
  it('renders the defaults when no options are given', async () => {
    const source = rateLimiter(await plan())

    expect(source).toContain('const WINDOW_MS = 900000')
    expect(source).toContain('const LIMIT = 100')
  })

  it('renders options from the stack and keeps defaults for the rest', async () => {
    const source = rateLimiter(await plan({ 'security-rate-limit': { limit: 500 } }))

    expect(source).toContain('const LIMIT = 500')
    expect(source).toContain('const WINDOW_MS = 900000')
  })

  it.each([
    [{ 'security-rate-limit': { limit: 0 } }, 'security-rate-limit'],
    [{ 'security-rate-limit': { burst: 3 } }, 'security-rate-limit'],
    [{ 'security-helmet': { strict: true } }, 'not selected'],
    [{ 'framework-express': { port: 1 } }, 'has no options']
  ])('rejects %j with an InputError (%s)', async (moduleOptions, expected) => {
    await expect(plan(moduleOptions)).rejects.toThrow(InputError)
    await expect(plan(moduleOptions)).rejects.toThrow(expected)
  })

  it('records resolved options in the manifest so a replay is identical', async () => {
    const original = await plan({ 'security-rate-limit': { limit: 500 } })
    const manifest = parseStackConfig(
      JSON.parse(original.files.find((file) => file.path === MANIFEST_PATH)?.content ?? '{}'),
      MANIFEST_PATH
    )
    const { ids, options } = splitModuleEntries(manifest.modules)

    const replayed = await plan(options, ids)

    expect(options['security-rate-limit']).toEqual({
      algorithm: 'fixed-window',
      windowMs: 900000,
      limit: 500
    })
    expect(replayed.files).toEqual(original.files)
  })
})

describe('stack config module entries', () => {
  it('accepts plain ids and { id, options } objects', () => {
    const config = parseStackConfig(
      {
        version: 1,
        name: 'opts-app',
        modules: ['framework-express', { id: 'security-rate-limit', options: { limit: 500 } }]
      },
      'stack.json'
    )

    expect(splitModuleEntries(config.modules)).toEqual({
      ids: ['framework-express', 'security-rate-limit'],
      options: { 'security-rate-limit': { limit: 500 } }
    })
  })
})

describe('language adapter in templates', () => {
  it('takes the Docker base image from the Node adapter', async () => {
    const result = await plan({}, ['framework-express', 'devops-docker'])
    const dockerfile = result.files.find((file) => file.path === 'Dockerfile')?.content ?? ''

    expect(dockerfile.match(/^FROM node:24-alpine/gm)).toHaveLength(2)
  })
})
