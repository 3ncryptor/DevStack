import { z } from 'zod'

import type { CatalogName } from '../catalog/node'
import type { GeneratorContext } from './context'
import type { PackageJsonFragment } from './package-json'

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
  postInstall?: (context: GeneratorContext) => Promise<void>
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
  packageJson: z
    .object({
      description: z.string().optional(),
      scripts: z.record(z.string(), z.string()).optional(),
      engines: z.record(z.string(), z.string()).optional()
    })
    .optional()
})
