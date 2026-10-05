import { z } from 'zod'

import { GATES } from './core/finish/verify'
import { CLI_PACKAGE } from './core/manifest'
import { buildGenerationPlan } from './core/planner/index'
import { PRESETS } from './core/presets'
import { answersFromModules, STEPS } from './prompts/wizard/steps'
import type { DevstackModule } from './types/module'
import type { PlannedFile } from './types/plan'

/**
 * A module as the website loads it (D-99): plain JSON. `filesPath` is left out (templates are
 * not rendered in the browser) and the options schema is JSON Schema, for the builder's fields.
 */
export type SiteModule = Omit<DevstackModule, 'filesPath' | 'options'> & {
  optionsSchema?: Record<string, unknown>
}

export function siteModules(modules: readonly DevstackModule[]): SiteModule[] {
  return modules.map((moduleDefinition) => {
    const site: SiteModule & Partial<Pick<DevstackModule, 'filesPath' | 'options'>> = {
      ...moduleDefinition
    }
    delete site.filesPath
    delete site.options
    return moduleDefinition.options === undefined
      ? site
      : { ...site, optionsSchema: z.toJSONSchema(moduleDefinition.options, { io: 'input' }) }
  })
}

/** What the website's product film shows: a real stack, answered and planned by DevStack. */
export interface FilmData {
  projectName: string
  packageName: string
  answers: Array<{ question: string; answer: string }>
  files: string[]
  gates: readonly string[]
  /** How many modules DevStack has to choose from. */
  modules: number
  /** What `add <module>` changes in that stack: files it creates and files it rewrites. */
  evolve: { module: string; added: string[]; changed: string[] }
}

const FILM_PRESET = 'fullstack-next-express'
const FILM_PROJECT = 'my-app'
const FILM_ADDITION = 'auth-jwt'

async function plannedFiles(
  modules: readonly string[],
  registry: Map<string, DevstackModule>
): Promise<PlannedFile[]> {
  const plan = await buildGenerationPlan({
    projectName: FILM_PROJECT,
    projectDir: `/virtual/${FILM_PROJECT}`,
    selectedModuleNames: [...modules],
    registry,
    packageManager: 'pnpm',
    options: { skipInstall: false, skipGit: false }
  })
  return plan.files
}

async function evolveData(
  modules: readonly string[],
  before: readonly PlannedFile[],
  registry: Map<string, DevstackModule>
): Promise<FilmData['evolve']> {
  const contents = new Map(before.map((file) => [file.path, file.content]))
  const after = await plannedFiles([...modules, FILM_ADDITION], registry)
  return {
    module: FILM_ADDITION,
    added: after.filter((file) => !contents.has(file.path)).map((file) => file.path),
    changed: after
      .filter((file) => contents.has(file.path) && contents.get(file.path) !== file.content)
      .map((file) => file.path)
  }
}

export async function filmData(registry: Map<string, DevstackModule>): Promise<FilmData> {
  const modules = PRESETS[FILM_PRESET]?.modules ?? []
  const answers = answersFromModules(modules, registry)
  const environment = { registry, defaultPackageManager: 'pnpm' as const }
  const files = await plannedFiles(modules, registry)
  return {
    projectName: FILM_PROJECT,
    packageName: CLI_PACKAGE.name,
    answers: STEPS.filter((step) => step.applies(answers, environment)).map((step) => ({
      question: step.label,
      answer: step.describe(answers, environment)
    })),
    files: files.map((file) => file.path),
    gates: GATES,
    modules: registry.size,
    evolve: await evolveData(modules, files, registry)
  }
}
