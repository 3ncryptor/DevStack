import { z } from 'zod'

import { PACKAGE_MANAGERS } from '../adapters/package-manager/index'

export const cliOptionSchema = z.strictObject({
  preset: z.string().optional(),
  /** Path to a stack config (stack.json or a project's .devstack/stack.json). */
  config: z.string().optional(),
  /** Package manager for the generated project; beats config and detection. */
  pm: z.enum(PACKAGE_MANAGERS).optional(),
  /** `bare` or `wired`; beats the config, default wired. */
  depth: z.enum(['bare', 'wired']).optional(),
  yes: z.boolean().default(false),
  advanced: z.boolean().default(false),
  inPlace: z.boolean().default(false),
  skipInstall: z.boolean().default(false),
  skipGit: z.boolean().default(false),
  verbose: z.boolean().default(false),
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  /** Print the plan and write nothing; `true` means text. */
  printPlan: z.union([z.literal(true), z.enum(['text', 'json'])]).optional()
})

export type CliOptions = z.infer<typeof cliOptionSchema>
