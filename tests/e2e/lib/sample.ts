import { loadModules } from '../../../src/core/module-loader'
import { resolveStack } from '../../../src/core/resolver/index'
import type {
  MultiselectPrompt,
  Prompter,
  SelectPrompt,
  TextPrompt
} from '../../../src/intake/prompter'
import { runWizard } from '../../../src/prompts/wizard/index'
import type { Combination, ModuleEntry } from './checks'

/** mulberry32: a small seeded generator, so a failing sample can be replayed with its seed. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Answers the real wizard at random: every sample is a stack a user could build, with the
 * wizard's own rules (which questions apply, which choices fit). It never picks a preset and
 * always generates at the review.
 */
class RandomPrompter implements Prompter {
  constructor(private readonly random: () => number) {}

  private pick<T>(items: readonly T[]): T | undefined {
    return items[Math.floor(this.random() * items.length)]
  }

  text(prompt: TextPrompt): Promise<string> {
    return Promise.resolve(prompt.initialValue ?? '')
  }

  select<T extends string>(prompt: SelectPrompt<T>): Promise<T> {
    const values = prompt.choices.map((choice) => choice.value)
    const fixed = values.find((value) => value === 'custom' || value === 'generate')
    const value = fixed ?? this.pick(values)
    if (value === undefined) throw new Error(`No choices for: ${prompt.message}`)
    return Promise.resolve(value)
  }

  multiselect<T extends string>(prompt: MultiselectPrompt<T>): Promise<T[]> {
    return Promise.resolve(
      prompt.choices.map((choice) => choice.value).filter(() => this.random() < 0.5)
    )
  }

  confirm(): Promise<boolean> {
    return Promise.resolve(this.random() < 0.5)
  }

  note(): void {
    // nothing to show
  }
}

/**
 * Nightly sampling (buildPlan B13): `count` random valid stacks, reproducible from `seed`. A
 * sample that does not resolve is a wizard bug, so it fails loudly instead of being skipped.
 */
export async function sampleCombinations(count: number, seed: number): Promise<Combination[]> {
  const registry = loadModules()
  const random = seededRandom(seed)
  const services = {
    preview: (draft: { modules: string[] }) =>
      Promise.resolve({
        diagnostics: resolveStack(draft.modules, registry).diagnostics,
        fileCount: draft.modules.length
      }),
    savePreset: () => Promise.reject(new Error('sampling never saves a preset'))
  }
  const combinations: Combination[] = []
  for (let index = 0; index < count; index += 1) {
    const selection = await runWizard(
      new RandomPrompter(random),
      { registry, projectName: 'sample', depth: 'wired', defaultPackageManager: 'pnpm' },
      services
    )
    const diagnostics = resolveStack(selection.modules, registry).diagnostics
    if (diagnostics.length > 0) {
      throw new Error(
        `sample ${index} (seed ${seed}) does not resolve: ${diagnostics.map((d) => d.message).join('; ')}`
      )
    }
    const modules: ModuleEntry[] = selection.modules.map((id) => {
      const options = selection.moduleOptions[id]
      return options === undefined ? id : { id, options }
    })
    // the wizard's settings (the module system) go into the stack config like the modules
    combinations.push({
      id: `sample-${seed}-${index}`,
      modules,
      ...(selection.settings === undefined ? {} : { settings: selection.settings })
    })
  }
  return combinations
}
