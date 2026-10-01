import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import {
  CLI_PACKAGE,
  MANIFEST_PATH,
  parseStackConfig,
  splitModuleEntries
} from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import { InputError } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import { loadStackConfig } from '../src/intake/config'
import type { GenerationPlan } from '../src/types/plan'
import { ScriptedPrompter } from './helpers/scripted-prompter'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

const valid = { version: 1, name: 'demo-app', modules: ['framework-express'] }

/** Each test gets its own fresh directory, removed when this file's tests are done. */
function freshDir(): Promise<string> {
  return tempDir('devstack-config-test-')
}

afterAll(removeTempDirs)

describe('parseStackConfig', () => {
  it('accepts a minimal config', () => {
    expect(parseStackConfig(valid, 'stack.json')).toEqual(valid)
  })

  it.each<[unknown, string]>([
    [{ ...valid, extra: true }, 'unknown key'],
    [{ ...valid, name: 'My App' }, 'invalid project name'],
    [{ ...valid, modules: [] }, 'no modules'],
    [{ ...valid, packageManager: 'pip' }, 'unsupported package manager'],
    [{ ...valid, version: 2 }, 'unsupported schema version'],
    [{ name: 'demo-app', modules: ['x'] }, 'missing version']
  ])('rejects %j (%s) with an InputError naming the file', (raw) => {
    expect(() => parseStackConfig(raw, 'stack.json')).toThrow(InputError)
    expect(() => parseStackConfig(raw, 'stack.json')).toThrow(/stack\.json/)
  })
})

describe('loadStackConfig', () => {
  it('reports a missing file clearly', async () => {
    const dir = await freshDir()

    await expect(loadStackConfig(path.join(dir, 'nope.json'))).rejects.toThrow(/not found/)
  })

  it('reports invalid JSON with the file path', async () => {
    const dir = await freshDir()
    const file = path.join(dir, 'stack.json')
    await writeFile(file, '{ "version": 1, ')

    await expect(loadStackConfig(file)).rejects.toThrow(/stack\.json.*not valid JSON/)
  })
})

async function backendPlan(overrides: Partial<Parameters<typeof buildGenerationPlan>[0]> = {}) {
  return buildGenerationPlan({
    projectName: 'replay-app',
    projectDir: '/virtual/replay-app',
    selectedModuleNames: [...(getPreset('backend')?.modules ?? [])],
    registry: loadModules(),
    packageManager: 'pnpm',
    options: { skipInstall: false, skipGit: false },
    ...overrides
  })
}

function manifestOf(plan: GenerationPlan): unknown {
  return JSON.parse(plan.files.find((file) => file.path === MANIFEST_PATH)?.content ?? 'null')
}

describe('.devstack/stack.json manifest', () => {
  it('records the resolved stack and the generating CLI', async () => {
    const plan = await backendPlan()

    expect(manifestOf(plan)).toEqual({
      version: 1,
      name: 'replay-app',
      packageManager: 'pnpm',
      modules: plan.modules.map((id) =>
        id === 'security-rate-limit'
          ? { id, options: { algorithm: 'fixed-window', windowMs: 900000, limit: 100 } }
          : id
      ),
      depth: 'wired',
      generatedBy: { name: CLI_PACKAGE.name, version: CLI_PACKAGE.version }
    })
  })

  it('replays to the same project when fed back in as a config (principle 5)', async () => {
    const original = await backendPlan()
    const config = parseStackConfig(manifestOf(original), MANIFEST_PATH)

    const { ids, options } = splitModuleEntries(config.modules)
    const replayed = await backendPlan({
      projectName: config.name,
      selectedModuleNames: ids,
      moduleOptions: options,
      packageManager: config.packageManager ?? 'npm'
    })

    expect(replayed.files).toEqual(original.files)
    expect(replayed.commands).toEqual(original.commands)
  })
})

describe('runCreateDevstack with --config', () => {
  it('refuses --config together with --preset', async () => {
    const dir = await freshDir()
    const file = path.join(dir, 'stack.json')
    await writeFile(file, JSON.stringify(valid))

    await expect(
      runCreateDevstack({
        options: { config: file, preset: 'backend', dryRun: true },
        prompter: new ScriptedPrompter([])
      })
    ).rejects.toThrow(/--config.*--preset/)
  })
})
