import type { DevstackModule } from '../../../../../types/module'

/**
 * Flat (B17.6): no architecture folders. Domain code still goes in src/modules/<name>/ with its
 * repository interfaces, so adapters stay swappable; only the grouping is collapsed. Being a
 * module (task 3.8), the choice is recorded in .devstack/stack.json like the others.
 */
const moduleDefinition: DevstackModule = {
  id: 'arch-flat',
  title: 'Flat',
  category: 'architecture',
  language: 'node',
  depth: 'bare',
  description: 'No extra architecture folders; features go in src/modules/<name>',
  requires: ['language-node']
}

export default moduleDefinition
