import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import * as prettier from 'prettier'
import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { toProjectRelativePath } from '../src/core/planner/files'
import { applyFixAction, resolveStack } from '../src/core/resolver/index'
import { BUILTIN_MODULES } from '../src/modules/index'
import { PACKAGE_ROOT } from '../src/paths'
import type { Depth, DevstackModule } from '../src/types/module'
import type { GenerationPlan } from '../src/types/plan'

const registry = loadModules()
const MAX_FIXES = 5

/**
 * The smallest stack around one module: its requirements are completed with the resolver's own
 * first fix (e.g. "Add framework-express"), so the test does not hand-pick partners. Prettier is
 * always added so the plan carries the project's formatting config.
 */
function minimalStack(moduleId: string): string[] {
  let selection = [moduleId, 'quality-prettier']
  for (let attempt = 0; attempt < MAX_FIXES; attempt += 1) {
    const fix = resolveStack(selection, registry).diagnostics.find(
      (diagnostic) => diagnostic.severity === 'error'
    )?.actions?.[0]
    if (fix === undefined) return selection
    selection = applyFixAction(selection, fix)
  }
  throw new Error(`${moduleId}: no stack without diagnostics after ${MAX_FIXES} fixes`)
}

const planFor = (modules: string[], depth: Depth): Promise<GenerationPlan> =>
  buildGenerationPlan({
    projectName: 'module-test',
    projectDir: '/virtual/module-test',
    selectedModuleNames: modules,
    registry,
    packageManager: 'pnpm',
    depth,
    options: { skipInstall: false, skipGit: false }
  })

async function unformatted(plan: GenerationPlan): Promise<string[]> {
  const config = JSON.parse(
    plan.files.find((file) => file.path === '.prettierrc')?.content ?? '{}'
  ) as prettier.Options
  const problems: string[] = []
  for (const file of plan.files) {
    if ((await prettier.getFileInfo(file.path)).inferredParser === null) continue
    if (!(await prettier.check(file.content, { ...config, filepath: file.path }))) {
      problems.push(file.path)
    }
  }
  return problems
}

/** Output paths of a module's templates, as the planner names them. */
async function templateOutputs(moduleDefinition: DevstackModule): Promise<string[]> {
  if (moduleDefinition.filesPath === undefined) return []
  const root = moduleDefinition.filesPath
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      toProjectRelativePath(path.relative(root, path.join(entry.parentPath, entry.name))).replace(
        /\.eta$/,
        ''
      )
    )
}

describe.each(BUILTIN_MODULES.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]))(
  'module %s (task 1.7)',
  (id, moduleDefinition) => {
    it.each<Depth>(['bare', 'wired'])(
      'plans on its own at %s depth, Prettier-clean',
      async (depth) => {
        const plan = await planFor(minimalStack(id), depth)

        expect(plan.modules).toContain(id)
        expect(await unformatted(plan)).toEqual([])
      }
    )

    it('contributes at least one of its own templates at wired depth', async () => {
      const outputs = await templateOutputs(moduleDefinition)
      const planned = new Set((await planFor(minimalStack(id), 'wired')).files.map((f) => f.path))

      if (outputs.length > 0) {
        // in a monorepo the module's files sit under its target directory, e.g. apps/web/
        const lands = (output: string): boolean =>
          [...planned].some(
            (plannedPath) => plannedPath === output || plannedPath.endsWith(`/${output}`)
          )
        expect(outputs.some(lands)).toBe(true)
      }
    })
  }
)

/** What a module definition may import: data and types, nothing that touches the machine. */
const ALLOWED_MODULE_IMPORTS = new Set(['../../paths', '../../types/module', 'zod'])

/**
 * Problems in one module source file: an import outside the allowed set, or dynamic loading. A
 * sibling data file (`./openapi`) is allowed when it follows the same rule.
 */
async function importProblems(dir: string, file: string): Promise<string[]> {
  const source = await readFile(path.join(dir, file), 'utf8')
  const specifiers = [...source.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)].map(
    (match) => match[1] ?? ''
  )
  // process.<property> in code; "process." ending a sentence in a comment is fine
  const dynamic = /\bimport\(|\brequire\(|\bprocess\.[a-z]/.test(source)
  const siblings = specifiers.filter((specifier) => /^\.\/[\w-]+$/.test(specifier))
  const nested = await Promise.all(
    siblings.map((sibling) => importProblems(dir, `${sibling.slice(2)}.ts`))
  )
  return [
    ...specifiers
      .filter(
        (specifier) => !ALLOWED_MODULE_IMPORTS.has(specifier) && !siblings.includes(specifier)
      )
      .map((specifier) => `${file} imports ${specifier}`),
    ...(dynamic ? [`${file} loads code dynamically or reads process`] : []),
    ...nested.flat()
  ]
}

describe('module contract lint (task 1.7)', () => {
  it.each(BUILTIN_MODULES.map((moduleDefinition) => moduleDefinition.id))(
    '%s/index.ts imports only data and types (no fs, child processes or network)',
    async (id) => {
      expect(
        await importProblems(path.join(PACKAGE_ROOT, 'src', 'modules', id), 'index.ts')
      ).toEqual([])
    }
  )
})
