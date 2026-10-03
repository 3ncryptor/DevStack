import { afterAll, describe, expect, it } from 'vitest'

import { runPlanCommands } from '../src/core/apply/commands'
import { CommandFailedError } from '../src/errors'
import type { GenerationPlan, PlannedCommand } from '../src/types/plan'
import type { Logger } from '../src/utils/logger'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)

const silent: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  success: () => {},
  debug: () => {}
}

const node = (code: string, cwd?: string): PlannedCommand => ({
  phase: 'postInstall',
  command: 'node',
  args: ['-e', code],
  description: code,
  ...(cwd === undefined ? {} : { cwd })
})

describe('runPlanCommands (D-95)', () => {
  it('names the failed command and every one after it, as the user would type them', async () => {
    const projectDir = await tempDir('commands-')
    const plan = {
      projectDir,
      commands: [
        node('process.exit(0)'),
        node('process.exit(1)'),
        node('process.exit(0)', 'apps/api')
      ]
    } as unknown as GenerationPlan

    const failure = await runPlanCommands(plan, silent, 'stderr').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(CommandFailedError)
    expect((failure as CommandFailedError).remaining).toEqual([
      'node -e process.exit(1)',
      '(cd apps/api && node -e process.exit(0))'
    ])
  })
})
