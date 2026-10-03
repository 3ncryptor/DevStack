import path from 'node:path'

import { MANIFEST_PATH } from '../core/manifest'
import { findPreset, PRESETS } from '../core/presets'
import {
  deleteUserPreset,
  devstackHome,
  listUserPresets,
  readUserPreset,
  USER_CONFIG_VERSION,
  writeUserPreset
} from '../core/user-home'
import { InputError } from '../errors'
import { loadStackConfig } from '../intake/config'

/** `presets list`: the built-in presets, then the user's own (task 5.5). */
export async function presetsList(home = devstackHome()): Promise<string> {
  const builtIn = Object.values(PRESETS).map(
    (preset) => `  ${preset.name.padEnd(26)} ${preset.description}`
  )
  const names = await listUserPresets(home)
  const saved = await Promise.all(
    names.map(async (name) => {
      const preset = await readUserPreset(name, home)
      return `  ${name.padEnd(26)} ${preset?.description ?? ''}`.trimEnd()
    })
  )
  return [
    'Built-in presets:',
    ...builtIn,
    '',
    saved.length === 0
      ? 'Your presets: none yet (presets save <name> in a DevStack project)'
      : 'Your presets:',
    ...saved,
    ''
  ].join('\n')
}

/** `presets show <name>`: the preset as JSON, built-in or saved. */
export async function presetsShow(name: string, home = devstackHome()): Promise<string> {
  const preset = await findPreset(name, home)
  if (preset === undefined) throw new InputError(`No preset named ${name}.`)
  return `${JSON.stringify(preset, null, 2)}\n`
}

export interface PresetSaveOptions {
  /** A stack config or a project's manifest; default: this project's .devstack/stack.json. */
  from?: string
  description?: string
  force: boolean
}

/**
 * `presets save <name>`: keeps a stack (modules with their options, settings, package manager,
 * depth) under a name, usable with `--preset <name>` and in the wizard. The project name is not
 * part of it: every project made from a preset gets its own.
 */
export async function presetsSave(
  name: string,
  options: PresetSaveOptions,
  cwd = process.cwd(),
  home = devstackHome()
): Promise<string> {
  if (PRESETS[name] !== undefined) {
    throw new InputError(`${name} is a built-in preset; choose another name.`)
  }
  const source = path.resolve(cwd, options.from ?? MANIFEST_PATH)
  const stack = await loadStackConfig(source)
  const file = await writeUserPreset(
    name,
    {
      version: USER_CONFIG_VERSION,
      ...(options.description === undefined ? {} : { description: options.description }),
      ...(stack.packageManager === undefined ? {} : { packageManager: stack.packageManager }),
      ...(stack.depth === undefined ? {} : { depth: stack.depth }),
      modules: stack.modules,
      ...(stack.settings === undefined ? {} : { settings: stack.settings })
    },
    { replace: options.force },
    home
  )
  return `Saved ${name} to ${file}\nUse it with --preset ${name}\n`
}

export async function presetsDelete(name: string, home = devstackHome()): Promise<string> {
  if (PRESETS[name] !== undefined)
    throw new InputError(`${name} is built in; it cannot be deleted.`)
  if (!(await deleteUserPreset(name, home))) throw new InputError(`No preset named ${name}.`)
  return `Deleted ${name}\n`
}
