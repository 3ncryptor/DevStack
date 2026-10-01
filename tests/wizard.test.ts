import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { PRESETS } from '../src/core/presets'
import { resolveStack } from '../src/core/resolver/index'
import { Aborted } from '../src/errors'
import {
  answersFromModules,
  APP_SETUP_CHOICES,
  modulesFromAnswers,
  type WizardAnswers
} from '../src/prompts/wizard/steps'
import {
  runAdvancedWizard,
  runWizard,
  type StackDraft,
  type WizardContext,
  type WizardServices
} from '../src/prompts/wizard/index'
import { ScriptedPrompter } from './helpers/scripted-prompter'

const registry = loadModules()

const CONTEXT: WizardContext = {
  registry,
  projectName: 'wizard-app',
  depth: 'wired',
  defaultPackageManager: 'npm'
}

/** Real resolution, fake planning (the file count is the module count), recorded saves. */
function fakeServices(): WizardServices & {
  saved: Array<{ fileName: string; draft: StackDraft }>
} {
  const saved: Array<{ fileName: string; draft: StackDraft }> = []
  return {
    saved,
    preview: (draft) =>
      Promise.resolve({
        diagnostics: resolveStack(draft.modules, registry).diagnostics,
        fileCount: draft.modules.length
      }),
    savePreset: (fileName, draft) => {
      saved.push({ fileName, draft })
      return Promise.resolve(`/virtual/${fileName}`)
    }
  }
}

const sorted = (ids: readonly string[]): string[] => [...ids].sort()

const ALWAYS = ['language-node', 'quality-eslint', 'quality-prettier']

describe('guided wizard (A0.2 order)', () => {
  it('asks the applicable questions in order and builds the stack from the answers', async () => {
    const prompter = new ScriptedPrompter([
      'custom',
      'framework-express',
      'postgres',
      'pnpm',
      'arch-mvc',
      true,
      false,
      ['middleware-cors', 'security-helmet'],
      'generate'
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).toEqual([
      'Start from a preset?',
      'Backend framework',
      'Database',
      'Package manager',
      'Backend architecture',
      'Add pre-commit hooks? (Husky, lint-staged, commitlint)',
      'Add a Dockerfile and docker compose?',
      'App setup (app.ts)',
      'What next?'
    ])
    expect(sorted(result.modules)).toEqual(
      sorted([
        ...ALWAYS,
        'framework-express',
        'orm-prisma',
        'arch-mvc',
        'quality-husky',
        'middleware-cors',
        'security-helmet'
      ])
    )
    expect(result.packageManager).toBe('pnpm')
  })

  it('picks a step with a single compatible option without asking (app type, ORM)', async () => {
    const prompter = new ScriptedPrompter([
      'custom',
      'framework-express',
      'postgres',
      'npm',
      'arch-clean',
      false,
      false,
      [],
      'generate'
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).not.toContain('App type')
    expect(prompter.asked).not.toContain('ORM')
    expect(result.modules).toContain('orm-prisma')
    expect(prompter.notes.join('\n')).toContain('ORM              Prisma')
  })

  it('skips the architecture question for NestJS, which has its own module layout', async () => {
    const prompter = new ScriptedPrompter([
      'custom',
      'framework-nest',
      'none',
      'npm',
      false,
      false,
      [],
      'generate'
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).not.toContain('Backend architecture')
    expect(prompter.asked).not.toContain('ORM')
    expect(sorted(result.modules)).toEqual(sorted([...ALWAYS, 'framework-nest']))
  })

  it('does not ask for the package manager when --pm or a config fixed it', async () => {
    const prompter = new ScriptedPrompter([
      'custom',
      'framework-nest',
      'none',
      false,
      false,
      [],
      'generate'
    ])

    const result = await runWizard(
      prompter,
      { ...CONTEXT, fixedPackageManager: 'yarn' },
      fakeServices()
    )

    expect(prompter.asked).not.toContain('Package manager')
    expect(result.packageManager).toBe('yarn')
  })

  it('marks package managers that are not installed', async () => {
    const choices: string[] = []
    const prompter = new ScriptedPrompter([
      'custom',
      'framework-nest',
      'none',
      'npm',
      false,
      false,
      [],
      'generate'
    ])
    const select = prompter.select.bind(prompter)
    prompter.select = (prompt) => {
      if (prompt.message === 'Package manager') {
        choices.push(...prompt.choices.map((choice) => `${choice.value}:${choice.hint ?? ''}`))
      }
      return select(prompt)
    }

    await runWizard(
      prompter,
      { ...CONTEXT, installedPackageManagers: new Set(['npm', 'pnpm']) },
      fakeServices()
    )

    expect(choices).toEqual(['npm:', 'pnpm:', 'yarn:not installed', 'bun:not installed'])
  })

  it('pre-fills every answer from a chosen preset and goes to review', async () => {
    const prompter = new ScriptedPrompter(['backend', 'npm', 'generate'])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).toEqual(['Start from a preset?', 'Package manager', 'What next?'])
    expect(sorted(result.modules)).toEqual(sorted(PRESETS.backend?.modules ?? []))
  })

  it('starts from --preset without asking which preset', async () => {
    const prompter = new ScriptedPrompter(['npm', 'generate'])

    const result = await runWizard(
      prompter,
      { ...CONTEXT, presetModules: PRESETS.backend?.modules },
      fakeServices()
    )

    expect(prompter.asked).toEqual(['Package manager', 'What next?'])
    expect(sorted(result.modules)).toEqual(sorted(PRESETS.backend?.modules ?? []))
  })
})

describe('review screen', () => {
  const nestAnswers = ['custom', 'framework-nest', 'none', 'npm', false, false, []]

  it('shows every answer, the always-included tooling and the file count', async () => {
    const prompter = new ScriptedPrompter([...nestAnswers, 'generate'])

    await runWizard(prompter, CONTEXT, fakeServices())
    const review = prompter.notes.find((note) => note.startsWith('Review'))

    expect(review).toContain('Framework        NestJS')
    expect(review).toContain('Always included  TypeScript, ESLint, Prettier')
    expect(review).toContain('Depth            wired')
    expect(review).toContain('Files            4')
  })

  it('edits one answer and asks any question that now applies', async () => {
    const prompter = new ScriptedPrompter([
      ...nestAnswers,
      'edit',
      'framework',
      'framework-express',
      'arch-clean',
      'generate'
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked.slice(-4)).toEqual([
      'Which answer?',
      'Backend framework',
      'Backend architecture',
      'What next?'
    ])
    expect(result.modules).toContain('framework-express')
    expect(result.modules).toContain('arch-clean')
    expect(result.modules).not.toContain('framework-nest')
  })

  it('drops modules of questions that no longer apply after an edit', async () => {
    const prompter = new ScriptedPrompter([
      'backend',
      'npm',
      'edit',
      'framework',
      'framework-nest',
      'generate'
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(result.modules).not.toContain('arch-clean')
  })

  it('saves the stack as a preset file and returns to the review', async () => {
    const services = fakeServices()
    const prompter = new ScriptedPrompter([...nestAnswers, 'save', 'nest.stack.json', 'generate'])

    await runWizard(prompter, CONTEXT, services)

    expect(services.saved).toEqual([
      {
        fileName: 'nest.stack.json',
        draft: {
          projectName: 'wizard-app',
          modules: expect.arrayContaining(['framework-nest']) as string[],
          packageManager: 'npm',
          depth: 'wired'
        }
      }
    ])
    expect(prompter.notes.join('\n')).toContain('--config /virtual/nest.stack.json')
  })

  it('reports a failed save and keeps the review open', async () => {
    const services = {
      ...fakeServices(),
      savePreset: () => Promise.reject(new Error('nest.stack.json already exists'))
    }
    const prompter = new ScriptedPrompter([...nestAnswers, 'save', 'nest.stack.json', 'generate'])

    await runWizard(prompter, CONTEXT, services)

    expect(prompter.notes.join('\n')).toContain('already exists')
  })

  it('throws Aborted on Cancel', async () => {
    const prompter = new ScriptedPrompter([...nestAnswers, 'cancel'])

    await expect(runWizard(prompter, CONTEXT, fakeServices())).rejects.toThrow(Aborted)
  })
})

describe('review problems', () => {
  const nestAnswers = ['custom', 'framework-nest', 'none', 'npm', false, false, []]

  it('blocks Generate while a problem is reported, until an edit clears it', async () => {
    const offered: string[][] = []
    const services: WizardServices = {
      ...fakeServices(),
      preview: (draft) =>
        Promise.resolve({
          diagnostics: [],
          fileCount: 4,
          problems: draft.packageManager === 'bun' ? ['bun is not installed.'] : []
        })
    }
    const prompter = new ScriptedPrompter([
      'custom',
      'framework-nest',
      'none',
      'bun',
      false,
      false,
      [],
      'edit',
      'packageManager',
      'npm',
      'generate'
    ])
    const select = prompter.select.bind(prompter)
    prompter.select = (prompt) => {
      if (prompt.message === 'What next?') offered.push(prompt.choices.map((c) => c.value))
      return select(prompt)
    }

    const result = await runWizard(prompter, CONTEXT, services)

    expect(offered[0]).toEqual(['edit', 'cancel'])
    expect(prompter.notes.join('\n')).toContain('bun is not installed.')
    expect(result.packageManager).toBe('npm')
  })

  it('suggests a preset file name without the npm scope', async () => {
    const defaults: string[] = []
    const prompter = new ScriptedPrompter([...nestAnswers, 'save', 'x.json', 'generate'])
    const text = prompter.text.bind(prompter)
    prompter.text = (prompt) => {
      defaults.push(prompt.initialValue ?? '')
      return text(prompt)
    }

    await runWizard(prompter, { ...CONTEXT, projectName: '@acme/api' }, fakeServices())

    expect(defaults).toEqual(['api.stack.json'])
  })
})

describe('advanced mode review', () => {
  it('offers only fixes that change the selection, once each', async () => {
    const offered: string[][] = []
    const services: WizardServices = {
      ...fakeServices(),
      preview: () =>
        Promise.resolve({
          diagnostics: [
            {
              severity: 'error',
              code: 'conflict',
              message: 'x conflicts with y',
              actions: [
                { label: 'Remove pulled-in', add: [], remove: ['only-required-by-others'] },
                { label: 'Remove a', add: [], remove: ['a'] }
              ]
            },
            {
              severity: 'error',
              code: 'conflict',
              message: 'a conflicts with z',
              actions: [{ label: 'Remove a', add: [], remove: ['a'] }]
            }
          ]
        })
    }
    const prompter = new ScriptedPrompter([['a', 'b'], 'cancel'])
    const select = prompter.select.bind(prompter)
    prompter.select = (prompt) => {
      offered.push(prompt.choices.map((choice) => choice.label))
      return select(prompt)
    }

    await expect(runAdvancedWizard(prompter, CONTEXT, services)).rejects.toThrow(Aborted)
    expect(offered[0]).toEqual(['Remove a', 'Edit an answer', 'Cancel'])
  })

  it('lists problems, hides Generate and offers the resolver fixes as choices', async () => {
    const offered: string[][] = []
    const prompter = new ScriptedPrompter([
      ['language-node', 'framework-express', 'framework-nest'],
      'fix:0',
      'generate'
    ])
    const select = prompter.select.bind(prompter)
    prompter.select = (prompt) => {
      offered.push(prompt.choices.map((choice) => choice.value))
      return select(prompt)
    }

    const result = await runAdvancedWizard(prompter, CONTEXT, fakeServices())

    expect(offered[0]).toEqual(['fix:0', 'fix:1', 'edit', 'cancel'])
    expect(prompter.notes.join('\n')).toContain('Only one framework module')
    expect(offered[1]).toContain('generate')
    expect(sorted(result.modules)).toEqual(['framework-express', 'language-node'])
  })
})

describe('answers ↔ modules', () => {
  it.each(Object.keys(PRESETS))('round-trips the %s preset', (name) => {
    const modules = PRESETS[name]?.modules ?? []

    expect(sorted(modulesFromAnswers(answersFromModules(modules), registry))).toEqual(
      sorted(modules)
    )
  })

  it('resolves every combination of answers without a diagnostic', () => {
    const subsets = (items: readonly string[]): string[][] =>
      items.reduce<string[][]>(
        (all, item) => [...all, ...all.map((subset) => [...subset, item])],
        [[]]
      )
    const failures: string[] = []
    for (const framework of ['framework-express', 'framework-nest']) {
      for (const database of ['postgres', 'none'] as const) {
        for (const architecture of ['arch-clean', 'arch-mvc', 'none']) {
          for (const preCommit of [true, false]) {
            for (const docker of [true, false]) {
              for (const appSetup of subsets(APP_SETUP_CHOICES.map((choice) => choice.value))) {
                const answers: WizardAnswers = {
                  appType: 'backend',
                  framework,
                  database,
                  orm: 'orm-prisma',
                  architecture,
                  preCommit,
                  docker,
                  appSetup
                }
                const modules = modulesFromAnswers(answers, registry)
                if (resolveStack(modules, registry).diagnostics.length > 0) {
                  failures.push(JSON.stringify(answers))
                }
              }
            }
          }
        }
      }
    }

    expect(failures).toEqual([])
  })
})
