import { BUILTIN_MODULES } from '../modules/index'
import type { DevstackModule } from '../types/module'
import { validateModuleDefinition } from './validator'

/** Validates the given module definitions and indexes them by name. */
export function loadModules(
  modules: readonly DevstackModule[] = BUILTIN_MODULES
): Map<string, DevstackModule> {
  const registry = new Map<string, DevstackModule>()

  for (const moduleDefinition of modules) {
    validateModuleDefinition(moduleDefinition)

    if (registry.has(moduleDefinition.name)) {
      throw new Error(`Duplicate module name found: "${moduleDefinition.name}"`)
    }

    registry.set(moduleDefinition.name, moduleDefinition)
  }

  return registry
}
