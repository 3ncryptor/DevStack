import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { splitModuleEntries } from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import { settingsSchema } from '../src/core/settings'
import { PACKAGE_ROOT } from '../src/paths'
import { parseMatrix, type Combination } from './e2e/lib/checks'
import { summarisePlan } from './helpers/plan-summary'

/**
 * Every e2e combination's plan, recorded (D-96): a refactor that changes generated output in any
 * combination fails here before the slow e2e run. Evolve steps are not replayed; the initial
 * plan is what the refactors touch.
 */

const matrix = parseMatrix(
  JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'tests', 'e2e', 'matrix.json'), 'utf8'))
)
const registry = loadModules()

function planFor(combination: Combination) {
  const entries = splitModuleEntries(
    combination.modules ?? getPreset(combination.preset ?? '')?.modules ?? []
  )
  return buildGenerationPlan({
    projectName: combination.id,
    projectDir: `/virtual/${combination.id}`,
    selectedModuleNames: entries.ids,
    moduleOptions: entries.options,
    registry,
    packageManager: 'pnpm',
    packageManagerVersion: '10.26.2',
    ...(combination.depth === undefined ? {} : { depth: combination.depth }),
    settings: settingsSchema.parse(combination.settings ?? {}),
    options: { skipInstall: false, skipGit: false },
    secret: () => 'fixed-matrix-secret-0123456789abcdefghijklmnop',
    now: () => new Date('2026-10-04T00:00:00Z')
  })
}

describe('e2e combination plans (D-96)', () => {
  it.each(matrix.map((combination) => [combination.id, combination]))(
    '%s plans as recorded',
    async (_id, combination) => {
      expect(summarisePlan(await planFor(combination))).toMatchSnapshot()
    }
  )
})
