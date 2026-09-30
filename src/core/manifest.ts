import { readFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { InputError } from '../errors'
import { PACKAGE_ROOT } from '../paths'
import { projectNameProblem } from './project-name'

/** Where every generated project records the stack it was generated from (buildPlan B12). */
export const MANIFEST_PATH = '.devstack/stack.json'

const STACK_CONFIG_VERSION = 1

export const CLI_PACKAGE = JSON.parse(
  readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')
) as { name: string; version: string }

/**
 * Stack config v1: the input to `--config` and, with `generatedBy`, the manifest written into
 * every project, so a manifest can be replayed as a config. Unknown keys are rejected.
 */
export const stackConfigSchema = z.strictObject({
  version: z.literal(STACK_CONFIG_VERSION),
  name: z.string().superRefine((name, context) => {
    const problem = projectNameProblem(name)
    if (problem !== undefined) context.addIssue({ code: 'custom', message: problem })
  }),
  packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']).optional(),
  modules: z.array(z.string().min(1)).min(1, 'List at least one module.'),
  generatedBy: z.strictObject({ name: z.string(), version: z.string() }).optional()
})

export type StackConfig = z.infer<typeof stackConfigSchema>

export function parseStackConfig(raw: unknown, source: string): StackConfig {
  const parsed = stackConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new InputError(`${source} is not a valid stack config:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export interface ManifestInput {
  projectName: string
  packageManager: NonNullable<StackConfig['packageManager']>
  /** Resolved module ids in dependency order. */
  modules: readonly string[]
}

/** The manifest contents; deterministic (no timestamps), so the same stack gives the same file. */
export function manifestFor(input: ManifestInput): StackConfig {
  return {
    version: STACK_CONFIG_VERSION,
    name: input.projectName,
    packageManager: input.packageManager,
    modules: [...input.modules],
    generatedBy: { name: CLI_PACKAGE.name, version: CLI_PACKAGE.version }
  }
}
