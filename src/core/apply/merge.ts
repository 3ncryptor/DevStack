/**
 * Merge strategies (task 1.3): generation adds to files the user already has instead of
 * replacing them. Existing values always win; nothing the user wrote is removed or changed.
 */

export interface JsonMergeResult {
  content: string
  /** Dotted paths where the user's value was kept although the generated one differs. */
  kept: string[]
}

export const MERGE_MARKER = '# added by create-devstack-app'

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function mergeObjects(
  existing: JsonObject,
  generated: JsonObject,
  prefix: string,
  kept: string[]
): JsonObject {
  const merged: JsonObject = { ...existing }
  for (const [key, value] of Object.entries(generated)) {
    const at = prefix === '' ? key : `${prefix}.${key}`
    if (!Object.hasOwn(existing, key)) {
      merged[key] = value
    } else if (isObject(existing[key]) && isObject(value)) {
      merged[key] = mergeObjects(existing[key], value, at, kept)
    } else if (!sameValue(existing[key], value)) {
      kept.push(at)
    }
  }
  return merged
}

/** Adds missing keys at any depth; undefined when the existing file is not a JSON object. */
export function mergeJson(existing: string, generated: string): JsonMergeResult | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(existing)
  } catch {
    // not JSON: the caller falls back to the normal conflict policy, which asks first
    return undefined
  }
  const planned: unknown = JSON.parse(generated)
  if (!isObject(parsed) || !isObject(planned)) return undefined
  const kept: string[] = []
  const merged = mergeObjects(parsed, planned, '', kept)
  return { content: `${JSON.stringify(merged, null, 2)}\n`, kept }
}

const significant = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed !== '' && !trimmed.startsWith('#')
}

/** Appends generated lines the file lacks (e.g. .gitignore entries), once, under a marker. */
export function mergeLines(existing: string, generated: string): string {
  const present = new Set(existing.split('\n').map((line) => line.trim()))
  const missing = generated
    .split('\n')
    .filter((line) => significant(line) && !present.has(line.trim()))
  if (missing.length === 0) return existing
  const base = existing === '' || existing.endsWith('\n') ? existing : `${existing}\n`
  return `${base}\n${MERGE_MARKER}\n${[...new Set(missing)].join('\n')}\n`
}
