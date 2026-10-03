import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { z } from 'zod'

import { PACKAGE_MANAGERS } from '../adapters/package-manager/index'
import { InputError } from '../errors'
import { settingsSchema } from './settings'

/**
 * DevStack's folder in the user's home (buildPlan A6 layers 3 and 5, tasks 5.4 and 5.5):
 * remembered defaults in config.json and named presets in presets/. DEVSTACK_CONFIG_HOME
 * overrides it (tests, CI), then XDG_CONFIG_HOME, then the platform's usual place.
 */
export function devstackHome(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DEVSTACK_CONFIG_HOME !== undefined && env.DEVSTACK_CONFIG_HOME !== '') {
    return env.DEVSTACK_CONFIG_HOME
  }
  const base =
    env.XDG_CONFIG_HOME ??
    (process.platform === 'win32' && env.APPDATA !== undefined
      ? env.APPDATA
      : path.join(os.homedir(), '.config'))
  return path.join(base, 'devstack')
}

export const USER_CONFIG_VERSION = 1

const answerValue = z.union([z.string(), z.boolean(), z.array(z.string())])

/** Remembered defaults: what the wizard pre-selects and `--yes` uses (A6 layer 5). */
export const userConfigSchema = z.strictObject({
  version: z.literal(USER_CONFIG_VERSION),
  packageManager: z.enum(PACKAGE_MANAGERS).optional(),
  depth: z.enum(['bare', 'wired']).optional(),
  settings: settingsSchema.optional(),
  /** Wizard answers by question key, e.g. `{ "framework": "framework-fastify" }`. */
  answers: z.record(z.string(), answerValue).optional()
})

export type UserConfig = z.infer<typeof userConfigSchema>

const EMPTY_CONFIG: UserConfig = { version: USER_CONFIG_VERSION }

const configFile = (home: string): string => path.join(home, 'config.json')

const errorCode = (error: unknown): unknown =>
  error instanceof Error && 'code' in error ? error.code : undefined

async function readJsonIfPresent(file: string): Promise<unknown> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return undefined
    throw error
  }
  try {
    return JSON.parse(text) as unknown
  } catch (error: unknown) {
    throw new InputError(`${file} is not valid JSON; fix or delete it.`, { cause: error })
  }
}

/** Writes through a temporary file and a rename, so a crash never leaves half a file. */
async function writeJsonAtomically(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, file)
}

/** The remembered defaults, or an empty set when none were saved. */
export async function readUserConfig(home = devstackHome()): Promise<UserConfig> {
  const raw = await readJsonIfPresent(configFile(home))
  if (raw === undefined) return EMPTY_CONFIG
  const parsed = userConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new InputError(
      `${configFile(home)} is not a valid DevStack config:\n${z.prettifyError(parsed.error)}`
    )
  }
  return parsed.data
}

export async function writeUserConfig(config: UserConfig, home = devstackHome()): Promise<string> {
  const parsed = userConfigSchema.parse(config)
  await writeJsonAtomically(configFile(home), parsed)
  return configFile(home)
}

export const userConfigPath = (home = devstackHome()): string => configFile(home)

/** A user preset: a stack config without a project name (A6 layer 3). */
export const userPresetSchema = z.strictObject({
  version: z.literal(USER_CONFIG_VERSION),
  description: z.string().trim().min(1).max(200).optional(),
  packageManager: z.enum(PACKAGE_MANAGERS).optional(),
  depth: z.enum(['bare', 'wired']).optional(),
  modules: z
    .array(
      z.union([
        z.string().min(1),
        z.strictObject({ id: z.string().min(1), options: z.record(z.string(), z.unknown()) })
      ])
    )
    .min(1, 'List at least one module.'),
  settings: settingsSchema.optional()
})

export type UserPreset = z.infer<typeof userPresetSchema>

/** Preset names become file names: kebab-case only, so no path can be smuggled in. */
export const PRESET_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const presetsDir = (home: string): string => path.join(home, 'presets')

function presetFile(home: string, name: string): string {
  if (!PRESET_NAME.test(name)) {
    throw new InputError(`Preset names are kebab-case (letters, digits, dashes); got "${name}".`)
  }
  return path.join(presetsDir(home), `${name}.json`)
}

export async function readUserPreset(
  name: string,
  home = devstackHome()
): Promise<UserPreset | undefined> {
  const file = presetFile(home, name)
  const raw = await readJsonIfPresent(file)
  if (raw === undefined) return undefined
  const parsed = userPresetSchema.safeParse(raw)
  if (!parsed.success) {
    throw new InputError(`${file} is not a valid preset:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export async function listUserPresets(home = devstackHome()): Promise<string[]> {
  try {
    const entries = await readdir(presetsDir(home))
    return entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.slice(0, -'.json'.length))
      .filter((name) => PRESET_NAME.test(name))
      .sort()
  } catch (error: unknown) {
    if (errorCode(error) === 'ENOENT') return []
    throw error
  }
}

/** Saves a preset; an existing one is replaced only when `replace` is set. */
export async function writeUserPreset(
  name: string,
  preset: UserPreset,
  options: { replace: boolean },
  home = devstackHome()
): Promise<string> {
  const file = presetFile(home, name)
  if (!options.replace && (await readJsonIfPresent(file)) !== undefined) {
    throw new InputError(`A preset named ${name} already exists; pass --force to replace it.`)
  }
  await writeJsonAtomically(file, userPresetSchema.parse(preset))
  return file
}

export async function deleteUserPreset(name: string, home = devstackHome()): Promise<boolean> {
  const file = presetFile(home, name)
  if ((await readJsonIfPresent(file)) === undefined) return false
  await rm(file)
  return true
}
