import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { PRESETS } from '../src/core/presets'
import { resolveStack } from '../src/core/resolver/index'
import { Aborted } from '../src/errors'
import type { SelectPrompt } from '../src/intake/prompter'
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
import { AnswerPrompter } from './helpers/answer-prompter'

const registry = loadModules()

const CONTEXT: WizardContext = {
  registry,
  projectName: 'wizard-app',
  depth: 'wired',
  defaultPackageManager: 'npm'
}

/** Question texts, as the wizard asks them. */
const Q = {
  preset: 'Start from a preset?',
  appType: 'App type',
  framework: 'Backend framework',
  frontend: 'Frontend framework',
  styling: 'Styling',
  admin: 'Add an admin frontend? (apps/admin on port 3002, same API)',
  frontendArchitecture: 'Frontend architecture',
  database: 'Database',
  orm: 'ORM',
  redis: 'Add Redis (cache, sessions)?',
  auth: 'Authentication',
  template: 'App template',
  logger: 'Logger',
  oauth: 'OAuth providers (client id and secret go in .env later)',
  packageManager: 'Package manager',
  architecture: 'Backend architecture',
  preCommit: 'Add pre-commit hooks? (Husky, lint-staged, commitlint)',
  tests: 'Test runner',
  docker: 'Add a Dockerfile and docker compose?',
  apiDocs: 'Add API docs? (Scalar at /docs, OpenAPI at /openapi.json)',
  appSetup: 'App setup (app.ts)',
  rateLimit: 'Rate-limit algorithm',
  versioning: 'Version the API under /v1? (health routes stay unversioned)',
  ci: 'Add GitHub Actions CI? (lint, format, typecheck, build, test)',
  asyncHandler:
    'Add an asyncHandler() wrapper for routes? (Express 5 forwards async errors without it)',
  repoExtras: 'Repo extras',
  next: 'What next?',
  which: 'Which answer?',
  saveAs: 'Save as'
} as const

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

/** Records the choices offered for one question. */
function offeredFor(prompter: AnswerPrompter, message: string): string[][] {
  const offered: string[][] = []
  const select = prompter.select.bind(prompter)
  prompter.select = <T extends string>(prompt: SelectPrompt<T>): Promise<T> => {
    if (prompt.message === message) {
      offered.push(prompt.choices.map((choice) => `${choice.value}:${choice.hint ?? ''}`))
    }
    return select(prompt)
  }
  return offered
}

const sorted = (ids: readonly string[]): string[] => [...ids].sort()

/** A minimal NestJS backend: no database, no extras. */
const NEST: ReadonlyArray<readonly [string, unknown]> = [
  [Q.framework, 'framework-nest'],
  [Q.database, 'none'],
  [Q.preCommit, false],
  [Q.tests, 'none'],
  [Q.docker, false],
  [Q.apiDocs, false],
  [Q.appSetup, []],
  [Q.versioning, false],
  [Q.ci, false],
  [Q.repoExtras, []]
]

describe('guided wizard (A0.2 order)', () => {
  it('asks the applicable questions in order, with their defaults', async () => {
    const prompter = new AnswerPrompter()

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).toEqual([
      Q.preset,
      Q.appType,
      Q.framework,
      Q.database,
      Q.orm,
      Q.redis,
      Q.auth,
      Q.logger,
      Q.template,
      Q.packageManager,
      Q.architecture,
      Q.preCommit,
      Q.tests,
      Q.docker,
      Q.apiDocs,
      Q.appSetup,
      Q.rateLimit,
      Q.versioning,
      Q.ci,
      Q.asyncHandler,
      Q.repoExtras,
      Q.next
    ])
    // the defaults: Express, Postgres + Prisma, feature folders, everything recommended on
    expect(result.modules).toEqual(
      expect.arrayContaining([
        'framework-express',
        'database-postgres',
        'orm-prisma',
        'arch-feature',
        'quality-husky',
        'testing-vitest',
        'devops-docker',
        'api-docs-scalar',
        'security-helmet',
        'security-rate-limit',
        'api-versioning',
        'devops-github-actions'
      ])
    )
    expect(result.modules).not.toContain('middleware-async-handler')
    expect(result.modules).not.toContain('auth-jwt')
    expect(result.moduleOptions).toEqual({ 'security-rate-limit': { algorithm: 'fixed-window' } })
  })

  it('adds auth-jwt when email + password auth is chosen (D-66)', async () => {
    const prompter = new AnswerPrompter([[Q.auth, 'auth-jwt']])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(result.modules).toContain('auth-jwt')
  })

  it('asks for OAuth providers after Better Auth and sets them as its options (D-38)', async () => {
    const prompter = new AnswerPrompter([
      [Q.auth, 'auth-better-auth'],
      [Q.oauth, ['github']]
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).toContain(Q.oauth)
    expect(result.modules).toContain('auth-better-auth')
    expect(result.moduleOptions['auth-better-auth']).toEqual({ github: true, google: false })
  })

  it('adds the Todo template when chosen (D-39)', async () => {
    const prompter = new AnswerPrompter([[Q.template, 'template-todo']])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(result.modules).toContain('template-todo')
  })

  it('does not offer auth without Express and Prisma (M3 scope)', async () => {
    const prompter = new AnswerPrompter(NEST)

    await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).not.toContain(Q.auth)
  })

  it('pre-fills the auth answer from a module list', () => {
    expect(answersFromModules(['framework-express', 'orm-prisma', 'auth-jwt']).auth).toBe(
      'auth-jwt'
    )
    expect(answersFromModules(['framework-express', 'database-postgres', 'orm-prisma']).auth).toBe(
      'none'
    )
  })

  it('picks a step with a single compatible option without asking (ORM)', async () => {
    const prompter = new AnswerPrompter([[Q.database, 'database-mongodb']])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).not.toContain(Q.orm)
    expect(result.modules).toContain('orm-mongoose')
    expect(prompter.notes.join('\n')).toContain('ORM              Mongoose')
  })

  it('skips the Express-only questions for NestJS', async () => {
    const prompter = new AnswerPrompter(NEST)

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    for (const skipped of [Q.architecture, Q.orm, Q.asyncHandler]) {
      expect(prompter.asked).not.toContain(skipped)
    }
    expect(sorted(result.modules)).toEqual(
      sorted(['language-node', 'quality-eslint', 'quality-prettier', 'framework-nest'])
    )
    expect(prompter.unused()).toEqual([])
  })

  it('does not ask for the package manager when --pm or a config fixed it', async () => {
    const prompter = new AnswerPrompter(NEST)

    const result = await runWizard(
      prompter,
      { ...CONTEXT, fixedPackageManager: 'yarn' },
      fakeServices()
    )

    expect(prompter.asked).not.toContain(Q.packageManager)
    expect(result.packageManager).toBe('yarn')
  })

  it('marks package managers that are not installed', async () => {
    const prompter = new AnswerPrompter(NEST)
    const offered = offeredFor(prompter, Q.packageManager)

    await runWizard(
      prompter,
      { ...CONTEXT, installedPackageManagers: new Set(['npm', 'pnpm']) },
      fakeServices()
    )

    expect(offered[0]).toEqual(['npm:', 'pnpm:', 'yarn:not installed', 'bun:not installed'])
  })

  it('pre-fills every answer from a chosen preset and goes to review', async () => {
    const prompter = new AnswerPrompter([[Q.preset, 'backend']])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).toEqual([Q.preset, Q.packageManager, Q.next])
    expect(sorted(result.modules)).toEqual(sorted(PRESETS.backend?.modules ?? []))
  })

  it('starts from --preset without asking which preset', async () => {
    const prompter = new AnswerPrompter()

    const result = await runWizard(
      prompter,
      { ...CONTEXT, presetModules: PRESETS.backend?.modules },
      fakeServices()
    )

    expect(prompter.asked).toEqual([Q.packageManager, Q.next])
    expect(sorted(result.modules)).toEqual(sorted(PRESETS.backend?.modules ?? []))
  })
})

describe('questions added for D-64 and M2', () => {
  it('asks for the rate-limit algorithm only with rate limiting, and returns it as an option', async () => {
    const without = new AnswerPrompter([...NEST])
    const withLimit = new AnswerPrompter([
      ...NEST.filter(([message]) => message !== Q.appSetup),
      [Q.appSetup, ['security-rate-limit']],
      [Q.rateLimit, 'leaky-bucket']
    ])

    await runWizard(without, CONTEXT, fakeServices())
    const result = await runWizard(withLimit, CONTEXT, fakeServices())

    expect(without.asked).not.toContain(Q.rateLimit)
    expect(result.moduleOptions).toEqual({ 'security-rate-limit': { algorithm: 'leaky-bucket' } })
  })

  it('adds Vitest for the API and, in a fullstack app, for the web apps', () => {
    const modules = modulesFromAnswers(
      {
        appType: 'fullstack',
        framework: 'framework-express',
        frontend: 'framework-nextjs',
        tests: 'testing-vitest'
      },
      registry
    )

    expect(modules).toEqual(expect.arrayContaining(['testing-vitest', 'testing-vitest-web']))
  })

  it('builds a fullstack monorepo: styling, admin, frontend folders, images for each app', async () => {
    const prompter = new AnswerPrompter([
      [Q.appType, 'fullstack'],
      [Q.admin, true],
      [Q.frontendArchitecture, 'arch-web-atomic']
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked).toEqual(
      expect.arrayContaining([Q.styling, Q.admin, Q.frontendArchitecture])
    )
    expect(prompter.asked).not.toContain(Q.frontend)
    expect(result.modules).toEqual(
      expect.arrayContaining([
        'layout-monorepo',
        'framework-nextjs',
        'ui-tailwind',
        'app-admin',
        'arch-web-atomic',
        'devops-docker',
        'devops-docker-web',
        'testing-vitest-web'
      ])
    )
  })

  it('pre-fills the fullstack answers from its modules', () => {
    const answers = answersFromModules(['framework-express', 'framework-nextjs', 'layout-monorepo'])

    expect(answers).toMatchObject({
      appType: 'fullstack',
      frontend: 'framework-nextjs',
      styling: 'none'
    })
  })
})

describe('review screen', () => {
  it('shows every answer, the always-included tooling and the file count', async () => {
    const prompter = new AnswerPrompter(NEST)

    await runWizard(prompter, CONTEXT, fakeServices())
    const review = prompter.notes.find((note) => note.startsWith('Review'))

    expect(review).toContain('Framework        NestJS')
    expect(review).toContain('Always included  TypeScript, ESLint, Prettier')
    expect(review).toContain('Depth            wired')
    expect(review).toContain('Files            4')
  })

  it('edits one answer and asks any question that now applies', async () => {
    const prompter = new AnswerPrompter([
      ...NEST,
      [Q.next, 'edit'],
      [Q.which, 'framework'],
      [Q.framework, 'framework-express'],
      [Q.architecture, 'arch-clean'],
      [Q.asyncHandler, true]
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(prompter.asked.slice(prompter.asked.indexOf(Q.which))).toEqual([
      Q.which,
      Q.framework,
      Q.architecture,
      Q.asyncHandler,
      Q.next
    ])
    expect(result.modules).toEqual(
      expect.arrayContaining(['framework-express', 'arch-clean', 'middleware-async-handler'])
    )
    expect(result.modules).not.toContain('framework-nest')
  })

  it('drops modules of questions that no longer apply after an edit', async () => {
    const prompter = new AnswerPrompter([
      [Q.preset, 'backend'],
      [Q.next, 'edit'],
      [Q.which, 'framework'],
      [Q.framework, 'framework-nest']
    ])

    const result = await runWizard(prompter, CONTEXT, fakeServices())

    expect(result.modules).not.toContain('arch-clean')
  })

  it('saves the stack as a preset file and returns to the review', async () => {
    const services = fakeServices()
    const prompter = new AnswerPrompter([...NEST, [Q.next, 'save'], [Q.saveAs, 'nest.stack.json']])

    await runWizard(prompter, CONTEXT, services)

    expect(services.saved).toEqual([
      {
        fileName: 'nest.stack.json',
        draft: {
          projectName: 'wizard-app',
          modules: expect.arrayContaining(['framework-nest']) as string[],
          packageManager: 'npm',
          depth: 'wired',
          moduleOptions: {}
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
    const prompter = new AnswerPrompter([...NEST, [Q.next, 'save']])

    await runWizard(prompter, CONTEXT, services)

    expect(prompter.notes.join('\n')).toContain('already exists')
  })

  it('throws Aborted on Cancel', async () => {
    const prompter = new AnswerPrompter([...NEST, [Q.next, 'cancel']])

    await expect(runWizard(prompter, CONTEXT, fakeServices())).rejects.toThrow(Aborted)
  })

  it('blocks Generate while a problem is reported, until an edit clears it', async () => {
    const services: WizardServices = {
      ...fakeServices(),
      preview: (draft) =>
        Promise.resolve({
          diagnostics: [],
          fileCount: 4,
          problems: draft.packageManager === 'bun' ? ['bun is not installed.'] : []
        })
    }
    const prompter = new AnswerPrompter([
      ...NEST,
      [Q.packageManager, 'bun'],
      [Q.next, 'edit'],
      [Q.which, 'packageManager'],
      [Q.packageManager, 'npm']
    ])
    const offered = offeredFor(prompter, Q.next)

    const result = await runWizard(prompter, CONTEXT, services)

    expect(offered[0]).toEqual(['edit:', 'cancel:'])
    expect(prompter.notes.join('\n')).toContain('bun is not installed.')
    expect(result.packageManager).toBe('npm')
  })

  it('suggests a preset file name without the npm scope', async () => {
    const defaults: string[] = []
    const prompter = new AnswerPrompter([...NEST, [Q.next, 'save'], [Q.saveAs, 'x.json']])
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
  it('lists problems, hides Generate and offers the resolver fixes as choices', async () => {
    const prompter = new AnswerPrompter([
      ['Select modules to include', ['language-node', 'framework-express', 'framework-nest']],
      [Q.next, 'fix:0']
    ])
    const offered = offeredFor(prompter, Q.next)

    const result = await runAdvancedWizard(prompter, CONTEXT, fakeServices())

    expect(offered[0]).toEqual(['fix:0:', 'fix:1:', 'edit:', 'cancel:'])
    expect(prompter.notes.join('\n')).toContain('Only one framework module')
    expect(offered[1]?.[0]).toBe('generate:')
    expect(sorted(result.modules)).toEqual(['framework-express', 'language-node'])
  })

  it('offers only fixes that change the selection, once each', async () => {
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
    const prompter = new AnswerPrompter([
      ['Select modules to include', ['a', 'b']],
      [Q.next, 'cancel']
    ])
    const offered = offeredFor(prompter, Q.next)

    await expect(runAdvancedWizard(prompter, CONTEXT, services)).rejects.toThrow(Aborted)
    expect(offered[0]).toEqual(['fix:0:', 'edit:', 'cancel:'])
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
    // every dimension with a rule between modules; independent ones (CI, styling, frontend
    // folders) are fixed, since they cannot change whether a stack resolves
    const appSetups = [[], APP_SETUP_CHOICES.map((choice) => choice.value)]
    /** Every combination of the given values, one answers object each. */
    const product = (dimensions: Record<string, readonly unknown[]>): WizardAnswers[] =>
      Object.entries(dimensions).reduce<WizardAnswers[]>(
        (combinations, [key, values]) =>
          combinations.flatMap((answers) => values.map((value) => ({ ...answers, [key]: value }))),
        [{ orm: 'orm-prisma', frontend: 'framework-nextjs' }]
      )
    const combinations = product({
      appType: ['backend', 'fullstack'],
      styling: ['ui-tailwind'],
      admin: [true, false],
      frontendArchitecture: ['arch-web-feature'],
      framework: ['framework-express', 'framework-nest'],
      database: [
        'database-postgres',
        'database-mysql',
        'database-sqlite',
        'database-mongodb',
        'none'
      ],
      orm: ['orm-prisma', 'orm-drizzle', 'orm-mongoose'],
      architecture: ['arch-feature', 'none'],
      tests: ['testing-vitest', 'none'],
      docker: [true, false],
      apiDocs: [true, false],
      ci: [true],
      asyncHandler: [true, false],
      appSetup: appSetups,
      apiVersioning: [true, false]
    })

    // the wizard offers Mongoose only on MongoDB, and Prisma or Drizzle only on SQL (D-77)
    const offered = combinations.filter((answers) =>
      answers.database === 'none'
        ? answers.orm === 'orm-prisma'
        : (answers.orm === 'orm-mongoose') === (answers.database === 'database-mongodb')
    )
    const failures = offered
      .filter(
        (answers) =>
          resolveStack(modulesFromAnswers(answers, registry), registry).diagnostics.length > 0
      )
      .map((answers) => JSON.stringify(answers))

    expect(offered).toHaveLength(8192)
    expect(failures).toEqual([])
  })
})
