import { z } from 'zod'

import { PACKAGE_MANAGERS } from '../adapters/package-manager/index'
import { MODULE_SYSTEMS } from '../core/settings'

export const cliOptionSchema = z.strictObject({
  preset: z.string().optional(),
  /** `--modules`: the stack as module ids, like an inline preset (D-99). */
  modules: z.array(z.string().min(1)).min(1).optional(),
  /** `--option <module>.<key>=<value>`, parsed. */
  moduleOptions: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  /** Path to a stack config (stack.json or a project's .devstack/stack.json). */
  config: z.string().optional(),
  /** Package manager for the generated project; beats config and detection. */
  pm: z.enum(PACKAGE_MANAGERS).optional(),
  /** `bare` or `wired`; beats the config, default wired. */
  depth: z.enum(['bare', 'wired']).optional(),
  /** `esm` or `cjs` for the backend (D-91); beats the config and the wizard. */
  moduleSystem: z.enum(MODULE_SYSTEMS).optional(),
  yes: z.boolean().default(false),
  advanced: z.boolean().default(false),
  inPlace: z.boolean().default(false),
  skipInstall: z.boolean().default(false),
  skipGit: z.boolean().default(false),
  /** Skip the gates and boot check after install; the project is then "Not verified". */
  skipVerify: z.boolean().default(false),
  /** Existing, empty GitHub repository to push the initial commit to (A0.5). */
  github: z.string().optional(),
  /** Start the project after generation (A0.4 step 7). */
  start: z.boolean().default(false),
  verbose: z.boolean().default(false),
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  /** Print the plan and write nothing; `true` means text. */
  printPlan: z.union([z.literal(true), z.enum(['text', 'json'])]).optional()
})

export type CliOptions = z.infer<typeof cliOptionSchema>
