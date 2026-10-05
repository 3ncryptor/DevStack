import { describe, expect, it } from 'vitest'

import { commandFor } from '../src/core/stack-command'
import { loadModules } from '../src/core/module-loader'
import { DefaultsPrompter } from '../src/intake/defaults-prompter'
import { wizardForm } from '../src/prompts/wizard/form'
import { runWizard } from '../src/prompts/wizard/index'
import {
  answersFromModules,
  modulesFromAnswers,
  type StepEnvironment
} from '../src/prompts/wizard/steps'
import { sampleCombinations } from './e2e/lib/sample'

const registry = loadModules()
const environment: StepEnvironment = { registry, defaultPackageManager: 'pnpm' }

const sorted = (ids: readonly string[]): string[] => [...ids].sort()

describe('the wizard as a form (the website builder, D-99)', () => {
  it('with no picks, lands on the same stack as pressing Enter through the CLI wizard', async () => {
    const services = {
      preview: () => Promise.resolve({ diagnostics: [], fileCount: 0 }),
      savePreset: () => Promise.reject(new Error('not saved'))
    }
    const cli = await runWizard(
      new DefaultsPrompter(),
      { registry, projectName: 'app', depth: 'wired', defaultPackageManager: 'pnpm' },
      services
    )

    const form = await wizardForm({}, environment)

    expect(sorted(modulesFromAnswers(form.answers, registry))).toEqual(sorted(cli.modules))
  })

  it('rebuilds any stack the wizard can make from its answers', async () => {
    const samples = await sampleCombinations(25, 7)

    for (const sample of samples) {
      const ids = (sample.modules ?? []).map((entry) =>
        typeof entry === 'string' ? entry : entry.id
      )
      const form = await wizardForm(answersFromModules(ids, registry), environment)

      expect(sorted(modulesFromAnswers(form.answers, registry)), sample.id).toEqual(sorted(ids))
    }
  })

  it('asks later questions from earlier answers, offering only choices that fit', async () => {
    const mongo = await wizardForm({ database: 'database-mongodb' }, environment)
    const orm = mongo.questions.find((question) => question.key === 'orm')

    expect(mongo.answers.orm).toBe('orm-mongoose')
    expect(
      orm === undefined ||
        orm.kind !== 'select' ||
        !orm.choices.some((c) => c.value === 'orm-prisma')
    ).toBe(true)
  })

  it('falls back to the default when a pick no longer fits', async () => {
    const form = await wizardForm({ framework: 'not-a-framework' }, environment)

    expect(form.answers.framework).toBe((await wizardForm({}, environment)).answers.framework)
  })
})

describe('commandFor in PowerShell', () => {
  const selection = {
    projectName: 'my-app',
    modules: ['language-node', 'framework-express'],
    moduleOptions: { 'security-rate-limit': { algorithm: "it's" } }
  }

  it('runs npx.cmd and quotes the comma list, which PowerShell would split', () => {
    expect(commandFor(selection, 'create-devstack-app', 'powershell')).toBe(
      "npx.cmd create-devstack-app my-app --modules 'language-node,framework-express' --option 'security-rate-limit.algorithm=it''s' --yes"
    )
  })

  it('keeps the POSIX command unchanged', () => {
    expect(commandFor(selection, 'create-devstack-app')).toBe(
      "npx create-devstack-app my-app --modules language-node,framework-express --option 'security-rate-limit.algorithm=it'\\''s' --yes"
    )
  })
})
