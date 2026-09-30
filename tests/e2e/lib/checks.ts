/** Headers helmet sets by default; their absence means security middleware is not running. */
export const REQUIRED_SECURITY_HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy'
] as const

/** Headers that must not be present on a hardened response. */
export const FORBIDDEN_HEADERS = ['x-powered-by'] as const

export function securityHeaderProblems(headers: Headers): string[] {
  const missing = REQUIRED_SECURITY_HEADERS.filter((name) => !headers.has(name)).map(
    (name) => `missing header: ${name}`
  )
  const leaked = FORBIDDEN_HEADERS.filter((name) => headers.has(name)).map(
    (name) => `unexpected header: ${name}`
  )
  return [...missing, ...leaked]
}

export interface Combination {
  id: string
  /** Exactly one of preset / modules. */
  preset?: string
  modules?: string[]
}

/** Ids become folder and project names, so keep them to safe kebab-case. */
const COMBINATION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function parseMatrix(raw: unknown): Combination[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('e2e matrix must be a non-empty array')
  }

  return raw.map((entry: unknown, index) => {
    const candidate = entry as Partial<Combination> | null
    const hasPreset = typeof candidate?.preset === 'string'
    const hasModules =
      Array.isArray(candidate?.modules) && candidate.modules.every((id) => typeof id === 'string')
    if (typeof candidate?.id !== 'string' || hasPreset === hasModules) {
      throw new Error(
        `e2e matrix entry ${index} needs a string "id" and either "preset" or "modules"`
      )
    }
    if (!COMBINATION_ID.test(candidate.id)) {
      throw new Error(`e2e matrix entry ${index} id "${candidate.id}" must be kebab-case`)
    }
    return hasPreset
      ? { id: candidate.id, preset: candidate.preset }
      : { id: candidate.id, modules: candidate.modules }
  })
}
