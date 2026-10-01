import type { DevstackModule } from '../types/module'
import { moduleDefinitionSchema } from '../types/module'

export function validateModuleDefinition(moduleDefinition: DevstackModule): void {
  moduleDefinitionSchema.parse(moduleDefinition)
}
