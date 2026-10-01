/** Why a stack cannot be resolved (buildPlan B5). Returned as data so the wizard and MCP can act on it. */
export type DiagnosticCode =
  | 'unknown-module'
  | 'missing-requirement'
  | 'unmet-requirement'
  | 'conflict'
  | 'single-select'
  | 'cycle'
  | 'unknown-slot'
  | 'unknown-package'

/** One way to fix a diagnostic, as module ids to add and remove, so a UI can apply it directly. */
export interface FixAction {
  label: string
  add: string[]
  remove: string[]
}

export interface Diagnostic {
  severity: 'error' | 'warning'
  code: DiagnosticCode
  message: string
  /** The module the problem belongs to, when there is one. */
  moduleId?: string
  /** A concrete next step, e.g. "keep one of: framework-express, framework-nest". */
  fix?: string
  /** The fixes a UI can offer as choices; absent when the fix needs a code change. */
  actions?: FixAction[]
}
