import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { loadModules } from '../../src/core/module-loader'
import { buildGenerationPlan } from '../../src/core/planner/index'
import { tempDir } from './temp-dirs'

/** A generated project on disk, exactly as init would write its files (no install). */
export async function generatedProject(modules: string[]): Promise<string> {
  const dir = await tempDir('project-')
  const plan = await buildGenerationPlan({
    projectName: 'generated-app',
    projectDir: dir,
    selectedModuleNames: modules,
    registry: loadModules(),
    packageManager: 'pnpm',
    packageManagerVersion: '10.26.2',
    options: { skipInstall: false, skipGit: true }
  })
  for (const file of plan.files) {
    const target = path.join(dir, file.path)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.content)
  }
  return dir
}
