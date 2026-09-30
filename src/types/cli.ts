import { z } from 'zod'

export const cliOptionSchema = z.strictObject({
  preset: z.string().optional(),
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
