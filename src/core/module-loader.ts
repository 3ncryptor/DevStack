import { BUILTIN_MODULES } from '../modules/registry'
import type { DevstackModule } from '../types/module'
import { validateModuleDefinition } from './validator'

/** Validates the given module definitions and indexes them by name. */
export function loadModules(
  modules: readonly DevstackModule[] = BUILTIN_MODULES
): Map<string, DevstackModule> {
  const registry = new Map<string, DevstackModule>()

  for (const moduleDefinition of modules) {
    validateModuleDefinition(moduleDefinition)

    if (registry.has(moduleDefinition.id)) {
      throw new Error(`Duplicate module name found: "${moduleDefinition.id}"`)
    }

    registry.set(moduleDefinition.id, moduleDefinition)
  }

  return registry
}
