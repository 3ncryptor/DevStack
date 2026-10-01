import type { DevstackModule } from '../../src/types/module'

/** A minimal contract-v2 module for tests: only `id` and the fields under test need stating. */
export function testModule(definition: Partial<DevstackModule> & { id: string }): DevstackModule {
  return {
    title: definition.id,
    description: definition.id,
    category: 'misc',
    language: 'node',
    ...definition
  }
}
