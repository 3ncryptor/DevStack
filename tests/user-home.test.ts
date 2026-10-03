import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { configGet, configList, configSet, configUnset } from '../src/commands/config'
import { presetsDelete, presetsList, presetsSave, presetsShow } from '../src/commands/presets'
import type { Probe } from '../src/core/doctor'
import { findPreset } from '../src/core/presets'
import { devstackHome, readUserConfig } from '../src/core/user-home'
import { InputError } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const failingProbe: Probe = () => {
  throw new Error('the pre-flight must not run in a dry run')
}

interface PrintedPlan {
  modules: string[]
  packageManager: string
  depth: string
}

/** What the CLI prints with --print-plan json. */
function capturePlan(): () => PrintedPlan {
  const chunks: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(String(chunk))
    return true
  })
  return () => JSON.parse(chunks.join('')) as PrintedPlan
}

async function projectWithStack(stack: Record<string, unknown>): Promise<string> {
  const dir = await tempDir('project-')
  await writeFile(path.join(dir, 'stack.json'), JSON.stringify({ version: 1, ...stack }))
  return dir
}

const TEAM_STACK = {
  name: 'team-app',
  packageManager: 'pnpm',
  modules: ['framework-fastify', { id: 'security-rate-limit', options: { limit: 50 } }],
  settings: { license: 'MIT' }
}

describe('where DevStack keeps its files (tasks 5.4, 5.5)', () => {
  it('prefers DEVSTACK_CONFIG_HOME, then XDG_CONFIG_HOME', () => {
    expect(devstackHome({ DEVSTACK_CONFIG_HOME: '/custom' })).toBe('/custom')
    expect(devstackHome({ XDG_CONFIG_HOME: '/xdg' })).toBe(path.join('/xdg', 'devstack'))
  })
})

describe('config get/set/unset (task 5.4)', () => {
  it('stores typed values by dotted key and reads them back', async () => {
    const home = await tempDir('home-')

    await configSet('settings.style.semi', 'true', home)
    await configSet('settings.license', 'MIT', home)
    await configSet('packageManager', 'pnpm', home)

    expect(await configGet('settings.style.semi', home)).toBe('true\n')
    expect(await configGet('settings.license', home)).toBe('MIT\n')
    expect(await readUserConfig(home)).toEqual({
      version: 1,
      packageManager: 'pnpm',
      settings: { style: { semi: true }, license: 'MIT' }
    })
  })

  it('refuses unknown keys and invalid values, and changes nothing', async () => {
    const home = await tempDir('home-')
    await configSet('depth', 'bare', home)

    await expect(configSet('settings.colour', 'blue', home)).rejects.toThrow(InputError)
    await expect(configSet('packageManager', 'pip', home)).rejects.toThrow(InputError)
    await expect(configSet('version', '2', home)).rejects.toThrow(InputError)
    expect(await readUserConfig(home)).toEqual({ version: 1, depth: 'bare' })
  })

  it('forgets a key and the empty object around it', async () => {
    const home = await tempDir('home-')
    await configSet('settings.style.semi', 'true', home)

    await configUnset('settings.style.semi', home)

    expect(JSON.parse(await configList(home))).toEqual({ version: 1 })
    await expect(configGet('settings.style.semi', home)).rejects.toThrow(/not set/)
  })
})

describe('presets save/list/show/delete (task 5.5)', () => {
  it("saves a stack with its options and settings, without the project's name", async () => {
    const home = await tempDir('home-')
    const dir = await projectWithStack(TEAM_STACK)

    await presetsSave(
      'team-api',
      { from: 'stack.json', description: 'Team API', force: false },
      dir,
      home
    )
    const saved = JSON.parse(
      await readFile(path.join(home, 'presets', 'team-api.json'), 'utf8')
    ) as Record<string, unknown>

    expect(saved).toEqual({
      version: 1,
      description: 'Team API',
      packageManager: 'pnpm',
      modules: TEAM_STACK.modules,
      settings: { license: 'MIT' }
    })
    expect(await presetsList(home)).toContain('team-api')
    expect(await presetsShow('team-api', home)).toContain('"source": "user"')
    expect(await findPreset('team-api', home)).toMatchObject({
      modules: ['framework-fastify', 'security-rate-limit'],
      moduleOptions: { 'security-rate-limit': { limit: 50 } },
      settings: { license: 'MIT' }
    })
  })

  it('never overwrites without --force, never shadows or deletes a built-in', async () => {
    const home = await tempDir('home-')
    const dir = await projectWithStack(TEAM_STACK)
    const save = (name: string, force: boolean) =>
      presetsSave(name, { from: 'stack.json', force }, dir, home)
    await save('team-api', false)

    await expect(save('team-api', false)).rejects.toThrow(/already exists/)
    await expect(save('team-api', true)).resolves.toContain('Saved team-api')
    await expect(save('backend', true)).rejects.toThrow(/built-in/)
    await expect(presetsDelete('backend', home)).rejects.toThrow(/built in/)
    await expect(save('../x', false)).rejects.toThrow(/kebab-case/)
  })

  it('deletes a preset of yours', async () => {
    const home = await tempDir('home-')
    const dir = await projectWithStack(TEAM_STACK)
    await presetsSave('team-api', { from: 'stack.json', force: false }, dir, home)

    await presetsDelete('team-api', home)

    expect(await findPreset('team-api', home)).toBeUndefined()
  })
})

describe('init with remembered defaults and user presets (precedence, A6 layer 5)', () => {
  it('uses the remembered answers, package manager and depth with --yes', async () => {
    const home = await tempDir('home-')
    vi.stubEnv('DEVSTACK_CONFIG_HOME', home)
    await configSet(
      'answers',
      JSON.stringify({ framework: 'framework-fastify', docker: false }),
      home
    )
    await configSet('packageManager', 'bun', home)
    await configSet('depth', 'bare', home)
    const plan = capturePlan()

    await runCreateDevstack({
      projectName: 'remembered-app',
      options: { yes: true, printPlan: 'json' },
      probe: failingProbe
    })

    expect(plan().modules).toContain('framework-fastify')
    expect(plan().modules).not.toContain('devops-docker')
    expect(plan().packageManager).toBe('bun')
    expect(plan().depth).toBe('bare')
  })

  it('lets flags and a preset win over remembered defaults', async () => {
    const home = await tempDir('home-')
    vi.stubEnv('DEVSTACK_CONFIG_HOME', home)
    await configSet('packageManager', 'bun', home)
    await configSet('depth', 'bare', home)
    const plan = capturePlan()

    await runCreateDevstack({
      projectName: 'flags-app',
      options: { preset: 'backend', pm: 'npm', depth: 'wired', yes: true, printPlan: 'json' },
      probe: failingProbe
    })

    expect(plan().packageManager).toBe('npm')
    expect(plan().depth).toBe('wired')
    expect(plan().modules).toContain('framework-express')
  })

  it('generates from a user preset with --preset', async () => {
    const home = await tempDir('home-')
    vi.stubEnv('DEVSTACK_CONFIG_HOME', home)
    const dir = await projectWithStack({
      name: 'x',
      modules: ['framework-nest', 'security-helmet']
    })
    await presetsSave('team-nest', { from: 'stack.json', force: false }, dir, home)
    const plan = capturePlan()

    await runCreateDevstack({
      projectName: 'preset-app',
      options: { preset: 'team-nest', yes: true, printPlan: 'json' },
      probe: failingProbe
    })

    expect(plan().modules).toEqual(expect.arrayContaining(['framework-nest', 'security-helmet']))
  })

  it('names the presets to choose from when one is unknown', async () => {
    capturePlan()

    await expect(
      runCreateDevstack({
        projectName: 'x',
        options: { preset: 'nope', yes: true, printPlan: 'json' },
        probe: failingProbe
      })
    ).rejects.toThrow(/presets list/)
  })
})
