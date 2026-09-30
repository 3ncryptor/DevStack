import { z } from 'zod'

export const cliOptionSchema = z.strictObject({
  preset: z.string().optional(),
  yes: z.boolean().default(false),
  advanced: z.boolean().default(false),
  inPlace: z.boolean().default(false),
  skipInstall: z.boolean().default(false),
  skipGit: z.boolean().default(false),
  verbose: z.boolean().default(false)
})

export type CliOptions = z.infer<typeof cliOptionSchema>
