import { z } from 'zod'

import type { CatalogName } from '../catalog/node'
import type { PackageJsonFragment } from './package-json'

export interface ModuleCommand {
  phase: 'postInstall'
  run: readonly [binary: string, ...args: string[]]
}

export interface DevstackModule {
  name: string
  description: string
  /** Catalog package names; versions come from src/catalog (D-08). */
  dependencies?: readonly CatalogName[]
  devDependencies?: readonly CatalogName[]
  requires?: string[]
  requiresAny?: string[]
  conflictsWith?: string[]
  filesPath?: string
  packageJson?: PackageJsonFragment
  /** Commands run after install, as data (buildPlan B4). `run` is a binary and its arguments. */
  commands?: readonly ModuleCommand[]
}

export const moduleDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  requiresAny: z.array(z.string()).optional(),
  conflictsWith: z.array(z.string()).optional(),
  filesPath: z.string().optional(),
  commands: z
    .array(z.object({ phase: z.literal('postInstall'), run: z.array(z.string()).min(1) }))
    .optional(),
  packageJson: z
    .object({
      description: z.string().optional(),
      scripts: z.record(z.string(), z.string()).optional(),
      engines: z.record(z.string(), z.string()).optional()
    })
    .optional()
})
