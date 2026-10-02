/** Headers helmet sets by default; their absence means security middleware is not running. */
export const REQUIRED_SECURITY_HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy'
] as const

/** Headers that must not be present on a hardened response. */
export const FORBIDDEN_HEADERS = ['x-powered-by'] as const

/** Helmet's headers are required when the stack has Helmet; leaked headers never are. */
export function securityHeaderProblems(headers: Headers, helmet: boolean): string[] {
  const missing = (helmet ? REQUIRED_SECURITY_HEADERS : [])
    .filter((name) => !headers.has(name))
    .map((name) => `missing header: ${name}`)
  const leaked = FORBIDDEN_HEADERS.filter((name) => headers.has(name)).map(
    (name) => `unexpected header: ${name}`
  )
  return [...missing, ...leaked]
}

/** What GET /ready must answer: 200, or 503 with these checks failing (e.g. no database). */
export interface ReadyExpectation {
  status: 200 | 503
  failing: readonly string[]
}

export function readyProblems(status: number, body: unknown, expected: ReadyExpectation): string[] {
  const checks = (body as { checks?: Record<string, string> } | null)?.checks ?? {}
  const failing = Object.entries(checks)
    .filter(([, value]) => value !== 'ok')
    .map(([name]) => name)
    .sort()
  const problems: string[] = []
  if (status !== expected.status)
    problems.push(`GET /ready returned ${status}, expected ${expected.status}`)
  if (failing.join(',') !== [...expected.failing].sort().join(',')) {
    problems.push(
      `GET /ready failing checks: [${failing.join(', ')}], expected [${expected.failing.join(', ')}]`
    )
  }
  return problems
}

/** Unknown routes answer 404 with the error envelope (B17.2) carrying the request id. */
export function envelopeProblems(status: number, body: unknown, requestId: string): string[] {
  const envelope = body as {
    success?: unknown
    error?: { code?: unknown; requestId?: unknown }
  } | null
  const error = envelope?.error
  const problems: string[] = []
  if (envelope?.success !== false) problems.push('error envelope lacks success: false (D-61)')
  if (status !== 404) problems.push(`unknown route returned ${status}, expected 404`)
  if (error?.code !== 'NOT_FOUND') problems.push(`unknown route error code: ${String(error?.code)}`)
  if (error?.requestId !== requestId) problems.push('error envelope does not carry the request id')
  return problems
}

/** A module id, or `{ id, options }` like a stack config entry. */
export type ModuleEntry = string | { id: string; options: Record<string, unknown> }

export const moduleIdOf = (entry: ModuleEntry): string =>
  typeof entry === 'string' ? entry : entry.id

const isModuleEntry = (value: unknown): value is ModuleEntry =>
  typeof value === 'string' ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { options?: unknown }).options === 'object')

export interface Combination {
  id: string
  /** Exactly one of preset / modules. */
  preset?: string
  modules?: ModuleEntry[]
  /** Passed as --depth; default wired. */
  depth?: 'bare' | 'wired'
  /** false when the project has no server to boot (bare depth, no framework). */
  boot?: boolean
  /** Part of the fast smoke tier run on every change; the full tier runs everything. */
  smoke?: boolean
  /** Run the CLI's own finish pipeline: verification, initial commit, push to a local remote. */
  finish?: boolean
  /** Full tier, with Docker running: docker compose up the whole stack and check the status page. */
  compose?: boolean
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
    const hasModules = Array.isArray(candidate?.modules) && candidate.modules.every(isModuleEntry)
    if (typeof candidate?.id !== 'string' || hasPreset === hasModules) {
      throw new Error(
        `e2e matrix entry ${index} needs a string "id" and either "preset" or "modules"`
      )
    }
    if (!COMBINATION_ID.test(candidate.id)) {
      throw new Error(`e2e matrix entry ${index} id "${candidate.id}" must be kebab-case`)
    }
    const extra = {
      ...(candidate.depth === undefined ? {} : { depth: candidate.depth }),
      ...(candidate.boot === undefined ? {} : { boot: candidate.boot }),
      ...(candidate.smoke === undefined ? {} : { smoke: candidate.smoke }),
      ...(candidate.finish === undefined ? {} : { finish: candidate.finish }),
      ...(candidate.compose === undefined ? {} : { compose: candidate.compose })
    }
    return hasPreset
      ? { id: candidate.id, preset: candidate.preset, ...extra }
      : { id: candidate.id, modules: candidate.modules, ...extra }
  })
}
