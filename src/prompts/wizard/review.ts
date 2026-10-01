import type { PackageManagerId } from '../../adapters/package-manager/index'
import { projectDirectoryName } from '../../core/project-name'
import { formatDiagnostics } from '../../core/resolver/index'
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
  /** Writes the draft as a stack config and returns the path; never overwrites. */
  savePreset: (fileName: string, draft: StackDraft) => Promise<string>
}

export interface ReviewSubject<T> {
  initial: T
  draft: (state: T) => StackDraft
  /** Label/value rows for the summary. */
  rows: (state: T) => Array<[string, string]>
  edit: (state: T) => Promise<T>
  /** Present when the subject can take resolver fixes directly (advanced mode). */
  applyFix?: (state: T, action: FixAction) => T
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

function reviewChoices(blocked: boolean, fixes: readonly FixAction[]): Choice<string>[] {
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
    { value: 'save', label: 'Save as preset', hint: 'a stack file for --config' },
    { value: 'cancel', label: 'Cancel' }
  ]
}

async function savePreset(
  prompter: Prompter,
  services: WizardServices,
  draft: StackDraft
): Promise<void> {
  const fileName = await prompter.text({
    message: 'Save as',
    initialValue: `${projectDirectoryName(draft.projectName)}.stack.json`,
    validate: (value) => (value.endsWith('.json') ? undefined : 'Use a .json file name.')
  })
  try {
    const written = await services.savePreset(fileName, draft)
    prompter.note(`Saved ${written}.\nGenerate from it later with --config ${written}`, 'Preset')
  } catch (error: unknown) {
    // shown to the user, who stays on the review screen and can pick another name
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

    const choices = reviewChoices(errors.length > 0 || problems.length > 0, fixes)
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
    } else {
      const fix = fixes[Number(choice.slice('fix:'.length))]
      if (fix !== undefined && subject.applyFix !== undefined) {
        state = subject.applyFix(state, fix)
      }
    }
  }
}
