import { ResolutionError } from '../errors'
import type { DevstackModule } from '../types/module'
import { moduleDefinitionSchema } from '../types/module'

export function validateModuleDefinition(moduleDefinition: DevstackModule): void {
  moduleDefinitionSchema.parse(moduleDefinition)

  if (
    moduleDefinition.postInstall !== undefined &&
    typeof moduleDefinition.postInstall !== 'function'
  ) {
    throw new Error(`Module ${moduleDefinition.name} has an invalid postInstall hook`)
  }
}

export function validateModuleSelection(modules: DevstackModule[]): void {
  const selected = new Set(modules.map((moduleDefinition) => moduleDefinition.name))

  for (const moduleDefinition of modules) {
    for (const required of moduleDefinition.requires ?? []) {
      if (!selected.has(required)) {
        throw new ResolutionError(
          `Module "${moduleDefinition.name}" requires "${required}", but it is not selected`
        )
      }
    }

    const requiresAny = moduleDefinition.requiresAny ?? []
    if (requiresAny.length > 0) {
      const hasAny = requiresAny.some((requiredModuleName) => selected.has(requiredModuleName))
      if (!hasAny) {
        throw new ResolutionError(
          `Module "${moduleDefinition.name}" requires one of [${requiresAny.join(', ')}], but none are selected`
        )
      }
    }

    for (const conflicting of moduleDefinition.conflictsWith ?? []) {
      if (selected.has(conflicting)) {
        throw new ResolutionError(
          `Module "${moduleDefinition.name}" conflicts with "${conflicting}". Remove one of them.`
        )
      }
    }
  }
}
