import { z } from 'zod'

import {
  devstackHome,
  readUserConfig,
  userConfigPath,
  userConfigSchema,
  writeUserConfig,
  type UserConfig
} from '../core/user-home'
import { InputError } from '../errors'

/**
 * `config path|list|get|set|unset` (task 5.4): the remembered defaults, by dotted key, e.g.
 * `config set settings.style.semi true` or `config set packageManager pnpm`. Every change is
 * validated against the whole schema, so a typo in a key is refused, never stored.
 */

const KEY = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/

function keyPath(key: string): string[] {
  if (!KEY.test(key) || key.split('.').includes('version')) {
    throw new InputError(
      `"${key}" is not a config key, e.g. settings.style.semi or packageManager.`
    )
  }
  return key.split('.')
}

/** A value from the command line: JSON when it parses (true, 80, ["a"]), a plain string otherwise. */
export function parseConfigValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

type Tree = Record<string, unknown>

const isTree = (value: unknown): value is Tree =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function valueAt(tree: Tree, keys: readonly string[]): unknown {
  return keys.reduce<unknown>((node, key) => (isTree(node) ? node[key] : undefined), tree)
}

/** A copy of `tree` with `value` at `keys`; `undefined` removes the key and empty parents. */
function withValue(tree: Tree, keys: readonly string[], value: unknown): Tree {
  const [head, ...rest] = keys
  if (head === undefined) return tree
  const others = Object.fromEntries(Object.entries(tree).filter(([key]) => key !== head))
  if (rest.length === 0) {
    return value === undefined ? others : { ...others, [head]: value }
  }
  const current = tree[head]
  const child = withValue(isTree(current) ? current : {}, rest, value)
  return Object.keys(child).length === 0 ? others : { ...others, [head]: child }
}

function validated(candidate: Tree, key: string): UserConfig {
  const parsed = userConfigSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new InputError(`Cannot set ${key}:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export const configPath = (home = devstackHome()): string => `${userConfigPath(home)}\n`

export async function configList(home = devstackHome()): Promise<string> {
  return `${JSON.stringify(await readUserConfig(home), null, 2)}\n`
}

export async function configGet(key: string, home = devstackHome()): Promise<string> {
  const value = valueAt(await readUserConfig(home), keyPath(key))
  if (value === undefined) throw new InputError(`${key} is not set.`)
  return typeof value === 'string' ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`
}

export async function configSet(key: string, raw: string, home = devstackHome()): Promise<string> {
  const config = await readUserConfig(home)
  const next = validated(withValue(config, keyPath(key), parseConfigValue(raw)), key)
  await writeUserConfig(next, home)
  return `Set ${key} in ${userConfigPath(home)}\n`
}

export async function configUnset(key: string, home = devstackHome()): Promise<string> {
  const config = await readUserConfig(home)
  const next = validated(withValue(config, keyPath(key), undefined), key)
  await writeUserConfig(next, home)
  return `Removed ${key} from ${userConfigPath(home)}\n`
}
