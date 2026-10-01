import * as prettier from 'prettier'
import { describe, expect, it } from 'vitest'

import { MANIFEST_PATH } from '../src/core/manifest'
import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import { InputError } from '../src/errors'
import { runCreateDevstack } from '../src/index'
import type { Depth } from '../src/types/module'
import type { GenerationPlan } from '../src/types/plan'
import { ScriptedPrompter } from './helpers/scripted-prompter'

const BACKEND = [...(getPreset('backend')?.modules ?? [])]

function planAt(depth: Depth | undefined, modules: string[] = BACKEND): Promise<GenerationPlan> {
  return buildGenerationPlan({
    projectName: 'depth-app',
    projectDir: '/virtual/depth-app',
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager: 'npm',
    depth,
    options: { skipInstall: false, skipGit: false }
  })
}

const paths = (plan: GenerationPlan): string[] => plan.files.map((file) => file.path)

describe('--depth bare', () => {
  it('writes config, tooling and structure but no integration code', async () => {
    const files = paths(await planAt('bare'))

    for (const expected of [
      'tsconfig.json',
      'eslint.config.mjs',
      '.prettierrc',
      '.gitignore',
      'prisma/schema.prisma',
      'prisma.config.mjs',
      'src/application/.gitkeep'
    ]) {
      expect(files).toContain(expected)
    }
    for (const absent of [
      'src/app.ts',
      'src/server.ts',
      'src/routes/health.ts',
      'src/lib/prisma.ts',
      'src/middlewares/helmet.ts'
    ]) {
      expect(files).not.toContain(absent)
    }
  })

  it('keeps a compilable entry point so the project still builds', async () => {
    expect(paths(await planAt('bare'))).toContain('src/index.ts')
  })

  it('leaves out env vars and warnings that belong to integration code', async () => {
    const plan = await planAt('bare')

    expect(plan.env.map((variable) => variable.name)).toEqual(['DATABASE_URL'])
  })

  it('formats every file so the project passes `prettier --check`', async () => {
    const plan = await planAt('bare')
    const config = JSON.parse(
      plan.files.find((file) => file.path === '.prettierrc')?.content ?? '{}'
    ) as prettier.Options
    const unformatted: string[] = []
    for (const file of plan.files) {
      if ((await prettier.getFileInfo(file.path)).inferredParser === null) continue
      if (!(await prettier.check(file.content, { ...config, filepath: file.path })))
        unformatted.push(file.path)
    }

    expect(unformatted).toEqual([])
  })

  it('is recorded in the manifest so a replay matches', async () => {
    const plan = await planAt('bare')
    const manifest = JSON.parse(
      plan.files.find((file) => file.path === MANIFEST_PATH)?.content ?? '{}'
    ) as { depth?: string }

    expect(manifest.depth).toBe('bare')
  })
})

describe('--depth wired (default)', () => {
  it('generates the integration code', async () => {
    const files = paths(await planAt(undefined))

    expect(files).toContain('src/app.ts')
    expect(files).toContain('src/middlewares/helmet.ts')
  })

  it('no longer writes the unused src/index.ts next to a framework entry point', async () => {
    expect(paths(await planAt('wired'))).not.toContain('src/index.ts')
    expect(paths(await planAt('wired', ['language-node']))).toContain('src/index.ts')
  })
})

describe('--depth flag', () => {
  it('rejects an unknown depth', async () => {
    await expect(
      runCreateDevstack({
        projectName: 'depth-app',
        options: { depth: 'deep' as never, yes: true, dryRun: true },
        prompter: new ScriptedPrompter([])
      })
    ).rejects.toThrow(InputError)
  })
})
