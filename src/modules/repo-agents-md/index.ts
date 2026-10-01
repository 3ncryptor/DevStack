import type { DevstackModule } from '../../types/module'

/**
 * AGENTS.md and CLAUDE.md (B17.9, D-45). The planner writes them from the resolved stack
 * (src/core/planner/agents-md.ts), so this module has no templates.
 */
const moduleDefinition: DevstackModule = {
  id: 'repo-agents-md',
  title: 'AGENTS.md + CLAUDE.md',
  category: 'repo',
  language: 'node',
  target: 'root',
  depth: 'bare',
  description: 'Context for AI coding assistants: stack, commands, layout, conventions'
}

export default moduleDefinition
