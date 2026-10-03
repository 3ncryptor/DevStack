import { MERGE_MARKER } from '../apply/merge'

/**
 * Three-way merges for `add` and `remove` (task 5.6): what generation changed between the old and
 * the new plan is applied to the user's file, value by value, wherever the user's value is still
 * the old generated one. Everything the user changed themselves is kept and reported.
 */

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export interface Json3Result {
  content: string
  /** Dotted paths the user changed and generation changed too: the user's value was kept. */
  kept: string[]
}

function merge3(
  disk: JsonObject,
  old: JsonObject,
  next: JsonObject,
  prefix: string,
  kept: string[]
): JsonObject {
  let merged: JsonObject = { ...disk }
  for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
    const before = old[key]
    const after = next[key]
    if (same(before, after)) continue
    const at = prefix === '' ? key : `${prefix}.${key}`
    const current = merged[key]
    if (isObject(before) && isObject(after) && isObject(current)) {
      merged = { ...merged, [key]: merge3(current, before, after, at, kept) }
    } else if (same(current, before)) {
      // untouched by the user: take the new generated value, or drop it when it is gone
      merged =
        after === undefined
          ? Object.fromEntries(Object.entries(merged).filter(([name]) => name !== key))
          : { ...merged, [key]: after }
    } else if (!same(current, after)) {
      kept.push(at)
    }
  }
  return merged
}

/** undefined when the user's file is not a JSON object: the caller treats it as a conflict. */
export function mergeJson3(disk: string, old: string, next: string): Json3Result | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(disk)
  } catch {
    return undefined
  }
  const before: unknown = JSON.parse(old)
  const after: unknown = JSON.parse(next)
  if (!isObject(parsed) || !isObject(before) || !isObject(after)) return undefined
  const kept: string[] = []
  const merged = merge3(parsed, before, after, '', kept)
  return { content: `${JSON.stringify(merged, null, 2)}\n`, kept }
}

const APPROVAL = /^ {2}'([^']+)': true$/gm
const APPROVED_ITEM = /^\s+(?:-\s+)?(?:'([^']+)'|"([^"]+)"|([^\s:'"#]+))(?::\s*true)?\s*$/gm
const SECTION = (name: string): RegExp => new RegExp(`^${name}:\\s*$`, 'm')

/**
 * pnpm-workspace.yaml (task 5.6): the build approvals a new module needs, e.g. prisma or argon2,
 * added to both lists DevStack writes (pnpm 12 `allowBuilds`, pnpm 10 `onlyBuiltDependencies`).
 * undefined when the file is not in that shape: the caller reports a conflict instead.
 */
export function mergePnpmWorkspace(disk: string, generated: string): EnvAppendResult | undefined {
  const wanted = [...generated.matchAll(APPROVAL)].map((match) => match[1] ?? '')
  // every name approved in either list, quoted or not: `  'x': true`, `  x: true`, `  - 'x'`
  const approved = new Set(
    [...disk.matchAll(APPROVED_ITEM)].map((match) => match[1] ?? match[2] ?? match[3] ?? '')
  )
  const missing = wanted.filter((name) => name !== '' && !approved.has(name))
  if (missing.length === 0) return { content: disk, added: [] }
  if (!SECTION('allowBuilds').test(disk) || !SECTION('onlyBuiltDependencies').test(disk)) {
    return undefined
  }
  const content = disk
    .replace(SECTION('allowBuilds'), (header) =>
      [header, ...missing.map((name) => `  '${name}': true`)].join('\n')
    )
    .replace(SECTION('onlyBuiltDependencies'), (header) =>
      [header, ...missing.map((name) => `  - '${name}'`)].join('\n')
    )
  return { content, added: missing }
}

const ENV_LINE = /^([A-Za-z_][A-Za-z0-9_]*)=/

export interface EnvAppendResult {
  content: string
  added: string[]
}

/**
 * Adds the variables a new module needs to the user's .env, with their comments; existing values
 * are never touched. `.env` holds local secrets, so nothing is ever removed from it.
 */
export function appendEnv(disk: string, generated: string, note: string): EnvAppendResult {
  const present = new Set(
    disk
      .split('\n')
      .map((line) => ENV_LINE.exec(line.trim())?.[1])
      .filter((name): name is string => name !== undefined)
  )
  const blocks: string[] = []
  const added: string[] = []
  let comments: string[] = []
  // comments above the first variable are the file's header, not a variable's description
  let inHeader = true
  for (const line of generated.split('\n')) {
    const name = ENV_LINE.exec(line.trim())?.[1]
    if (name === undefined) {
      comments = !inHeader && line.trim().startsWith('#') ? [...comments, line] : []
      continue
    }
    inHeader = false
    if (!present.has(name)) {
      blocks.push(...comments, line)
      added.push(name)
    }
    comments = []
  }
  if (added.length === 0) return { content: disk, added }
  const base = disk === '' || disk.endsWith('\n') ? disk : `${disk}\n`
  return { content: `${base}\n${MERGE_MARKER} (${note})\n${blocks.join('\n')}\n`, added }
}
