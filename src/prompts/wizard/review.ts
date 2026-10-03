import type { PackageManagerId } from '../../adapters/package-manager/index'
import { projectDirectoryName } from '../../core/project-name'
import { formatDiagnostics } from '../../core/resolver/index'
import { PRESET_NAME } from '../../core/user-home'
import { Aborted } from '../../errors'
import type { Choice, Prompter } from '../../intake/prompter'
import type { Diagnostic, FixAction } from '../../types/diagnostics'
import type { Depth } from '../../types/module'

/** What the review screen would generate. */
export interface StackDraft {
  projectName: string
  modules: string[]
  packageManager: PackageManagerId
  depth: Depth
  /** Options the answers set, per module id (e.g. the rate-limit algorithm). */
  moduleOptions?: Record<string, Record<string, unknown>>
}

export interface StackPreview {
  diagnostics: Diagnostic[]
  /** Files the plan would write; absent when the stack does not resolve. */
  fileCount?: number
  /** Other reasons the stack cannot be generated, e.g. its package manager is not installed. */
  problems?: string[]
}

/** Side effects the review needs, injected so the wizard stays testable and writes nothing itself. */
export interface WizardServices {
  /** Resolves and plans the draft in memory. */
  preview: (draft: StackDraft) => Promise<StackPreview>
  /** Saves the draft as a named preset (task 5.5) and returns where; never overwrites. */
  savePreset: (name: string, draft: StackDraft) => Promise<string>
  /** Keeps the answers as remembered defaults (task 5.4) and returns where; absent: not offered. */
  rememberDefaults?: (
    answers: Readonly<Record<string, unknown>>,
    draft: StackDraft
  ) => Promise<string>
}

export interface ReviewSubject<T> {
  initial: T
  draft: (state: T) => StackDraft
  /** Label/value rows for the summary. */
  rows: (state: T) => Array<[string, string]>
  edit: (state: T) => Promise<T>
  /** Present when the subject can take resolver fixes directly (advanced mode). */
  applyFix?: (state: T, action: FixAction) => T
  /** The answers worth remembering as defaults (guided wizard only). */
  remember?: (state: T) => Readonly<Record<string, unknown>>
}

const LABEL_WIDTH = 16

const formatRows = (rows: ReadonlyArray<[string, string]>): string =>
  rows.map(([label, value]) => `${label.padEnd(LABEL_WIDTH)} ${value}`).join('\n')

const errorsIn = (preview: StackPreview): Diagnostic[] =>
  preview.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')

/** Fixes that would change this selection, once each; others would loop on the same error. */
function applicableFixes(errors: readonly Diagnostic[], modules: readonly string[]): FixAction[] {
  const labels = new Set<string>()
  const fixes: FixAction[] = []
  for (const fix of errors.flatMap((error) => error.actions ?? [])) {
    const removes = fix.remove.filter((id) => modules.includes(id))
    const adds = fix.add.filter((id) => !modules.includes(id))
    if (labels.has(fix.label) || removes.length !== fix.remove.length) continue
    if (adds.length === 0 && removes.length === 0) continue
    labels.add(fix.label)
    fixes.push(fix)
  }
  return fixes
}

function reviewChoices(
  blocked: boolean,
  fixes: readonly FixAction[],
  canRemember: boolean
): Choice<string>[] {
  if (blocked) {
    return [
      ...fixes.map((fix, index) => ({ value: `fix:${index}`, label: fix.label })),
      { value: 'edit', label: 'Edit an answer' },
      { value: 'cancel', label: 'Cancel' }
    ]
  }
  return [
    { value: 'generate', label: 'Generate' },
    { value: 'edit', label: 'Edit an answer' },
    { value: 'save', label: 'Save as preset', hint: 'reuse it with --preset <name>' },
    ...(canRemember
      ? [{ value: 'remember', label: 'Remember as my defaults', hint: 'pre-selected next time' }]
      : []),
    { value: 'cancel', label: 'Cancel' }
  ]
}

async function savePreset(
  prompter: Prompter,
  services: WizardServices,
  draft: StackDraft
): Promise<void> {
  const name = await prompter.text({
    message: 'Preset name',
    initialValue: projectDirectoryName(draft.projectName),
    validate: (value) =>
      PRESET_NAME.test(value) ? undefined : 'Use kebab-case: letters, digits and dashes.'
  })
  try {
    const written = await services.savePreset(name, draft)
    prompter.note(`Saved ${written}.\nStart a project from it with --preset ${name}`, 'Preset')
  } catch (error: unknown) {
    // shown to the user, who stays on the review screen and can pick another name
    prompter.note(error instanceof Error ? error.message : String(error), 'Not saved')
  }
}

async function rememberDefaults(
  prompter: Prompter,
  services: WizardServices,
  answers: Readonly<Record<string, unknown>>,
  draft: StackDraft
): Promise<void> {
  try {
    const written = await services.rememberDefaults?.(answers, draft)
    prompter.note(
      `Saved to ${written ?? 'your config'}; the wizard pre-selects these answers next time.`,
      'Defaults'
    )
  } catch (error: unknown) {
    prompter.note(error instanceof Error ? error.message : String(error), 'Not saved')
  }
}

/**
 * The review screen (A0.2 #20): nothing is written before the user picks Generate. When the
 * stack does not resolve, Generate is replaced by the resolver's fixes (B5).
 */
export async function runReview<T>(
  prompter: Prompter,
  subject: ReviewSubject<T>,
  services: WizardServices
): Promise<T> {
  let state = subject.initial
  while (true) {
    const draft = subject.draft(state)
    const preview = await services.preview(draft)
    const errors = errorsIn(preview)
    const problems = preview.problems ?? []
    const fixes = subject.applyFix === undefined ? [] : applicableFixes(errors, draft.modules)
    prompter.note(
      formatRows([
        ...subject.rows(state),
        ['Depth', draft.depth],
        ['Files', preview.fileCount === undefined ? '—' : String(preview.fileCount)]
      ]),
      'Review'
    )
    if (errors.length > 0 || problems.length > 0) {
      const lines = [
        ...(errors.length > 0 ? [formatDiagnostics(errors)] : []),
        ...problems.map((problem) => `  ✖ ${problem}`)
      ]
      prompter.note(lines.join('\n'), 'Problems')
    }

    const canRemember = subject.remember !== undefined && services.rememberDefaults !== undefined
    const choices = reviewChoices(errors.length > 0 || problems.length > 0, fixes, canRemember)
    const choice = await prompter.select({
      message: 'What next?',
      choices,
      initialValue: choices[0]?.value
    })
    if (choice === 'generate') return state
    if (choice === 'cancel') throw new Aborted()
    if (choice === 'edit') {
      state = await subject.edit(state)
    } else if (choice === 'save') {
      await savePreset(prompter, services, draft)
    } else if (choice === 'remember') {
      await rememberDefaults(prompter, services, subject.remember?.(state) ?? {}, draft)
    } else {
      const fix = fixes[Number(choice.slice('fix:'.length))]
      if (fix !== undefined && subject.applyFix !== undefined) {
        state = subject.applyFix(state, fix)
      }
    }
  }
}
