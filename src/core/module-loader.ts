import path from 'node:path'

import fs from 'fs-extra'

import type { DevstackModule } from '../types/module'
import { validateModuleDefinition } from './validator'

const MODULE_ENTRY_CANDIDATES = ['index.js', 'index.ts', 'index.mjs', 'index.cjs']

export function getBuiltinModulesRoot(): string {
  return path.resolve(__dirname, '../modules')
}

async function resolveModuleEntry(moduleDir: string): Promise<string | null> {
  for (const candidate of MODULE_ENTRY_CANDIDATES) {
    const candidatePath = path.join(moduleDir, candidate)
    if (await fs.pathExists(candidatePath)) {
      return candidatePath
    }
  }

  return null
}

function asDevstackModule(loaded: unknown, directoryName: string): DevstackModule {
  if (typeof loaded !== 'object' || loaded === null) {
    throw new Error(`Module "${directoryName}" does not export a module definition object`)
  }

  const maybeModule = loaded as DevstackModule
  return maybeModule
}

function unwrapDefaultExport(value: unknown): unknown {
  let unwrapped = value

  for (let index = 0; index < 5; index += 1) {
    if (typeof unwrapped !== 'object' || unwrapped === null) {
      return unwrapped
    }

    if (!('default' in unwrapped)) {
      return unwrapped
    }

    unwrapped = (unwrapped as { default: unknown }).default
  }

  return unwrapped
}

export async function loadModules(
  modulesRoot = getBuiltinModulesRoot()
): Promise<Map<string, DevstackModule>> {
  const entries = await fs.readdir(modulesRoot, { withFileTypes: true })
  const registry = new Map<string, DevstackModule>()

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const moduleDir = path.join(modulesRoot, entry.name)
    const moduleEntry = await resolveModuleEntry(moduleDir)
    if (!moduleEntry) {
      continue
    }

    const imported = (await import(moduleEntry)) as {
      default?: unknown
      module?: unknown
    }

    const moduleDefinition = asDevstackModule(
      unwrapDefaultExport(imported.module ?? imported.default ?? imported),
      entry.name
    )
    validateModuleDefinition(moduleDefinition)

    if (registry.has(moduleDefinition.name)) {
      throw new Error(`Duplicate module name found: "${moduleDefinition.name}"`)
    }

    registry.set(moduleDefinition.name, moduleDefinition)
  }

  return registry
}
