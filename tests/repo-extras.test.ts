import { describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { getPreset } from '../src/core/presets'
import type { GenerationPlan } from '../src/types/plan'

const EXTRAS = ['repo-agents-md', 'repo-vscode', 'repo-github-hygiene']

function plan(modules: readonly string[], packageManager: 'pnpm' | 'bun' = 'pnpm') {
  return buildGenerationPlan({
    projectName: 'extras-app',
    projectDir: '/virtual/extras-app',
    selectedModuleNames: [...modules],
    registry: loadModules(),
    packageManager,
    options: { skipInstall: false, skipGit: false }
  })
}

const contentOf = (generated: GenerationPlan, filePath: string): string =>
  generated.files.find((file) => file.path === filePath)?.content ?? ''

const FULLSTACK = [...(getPreset('fullstack-next-express')?.modules ?? [])]
const BACKEND = [...(getPreset('backend')?.modules ?? []), ...EXTRAS]

describe('repo extras (B17.9, D-45)', () => {
  it('writes AGENTS.md from the stack and a CLAUDE.md that imports it', async () => {
    const generated = await plan(FULLSTACK)
    const agents = contentOf(generated, 'AGENTS.md')

    expect(agents).toContain('pnpm run lint')
    expect(agents).toContain('`apps/api/`: the API')
    expect(agents).toContain('`apps/api/src/features/<feature>/`')
    expect(agents).toContain('`/v1`')
    expect(contentOf(generated, 'CLAUDE.md')).toBe('@AGENTS.md\n')
  })

  it('describes the single layout and the modules folder without a monorepo', async () => {
    const agents = contentOf(await plan(BACKEND), 'AGENTS.md')

    expect(agents).toContain('`src/modules/<feature>/`')
    expect(agents).not.toContain('apps/')
  })

  it('recommends VS Code extensions for the stack and valid JSON', async () => {
    const generated = await plan(FULLSTACK)
    const extensions = JSON.parse(contentOf(generated, '.vscode/extensions.json')) as {
      recommendations: string[]
    }
    const launch = JSON.parse(contentOf(generated, '.vscode/launch.json')) as {
      configurations: Array<{ cwd: string }>
    }

    expect(extensions.recommendations).toEqual(
      expect.arrayContaining(['prisma.prisma', 'bradlc.vscode-tailwindcss'])
    )
    expect(launch.configurations[0]?.cwd).toBe('${workspaceFolder}/apps/api')
    expect(JSON.parse(contentOf(generated, '.vscode/settings.json'))).toHaveProperty(
      'editor.formatOnSave',
      true
    )
  })

  it("points Dependabot at the project's package ecosystem and GitHub Actions", async () => {
    expect(contentOf(await plan(BACKEND), '.github/dependabot.yml')).toContain(
      "package-ecosystem: 'npm'"
    )
    expect(contentOf(await plan(BACKEND, 'bun'), '.github/dependabot.yml')).toContain(
      "package-ecosystem: 'bun'"
    )
    const generated = await plan(BACKEND)
    for (const file of [
      '.github/pull_request_template.md',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      '.github/ISSUE_TEMPLATE/feature_request.yml',
      '.github/CODEOWNERS'
    ]) {
      expect(contentOf(generated, file)).not.toBe('')
    }
  })

  it('writes none of it unless selected', async () => {
    const generated = await plan([...(getPreset('backend')?.modules ?? [])])

    for (const file of [
      'AGENTS.md',
      'CLAUDE.md',
      '.vscode/settings.json',
      '.github/dependabot.yml'
    ]) {
      expect(contentOf(generated, file)).toBe('')
    }
  })
})
