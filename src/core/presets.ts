export interface PresetDefinition {
  name: string
  description: string
  modules: string[]
}

export const PRESETS: Record<string, PresetDefinition> = {
  backend: {
    name: 'backend',
    description: 'TypeScript + Express + Prisma + quality tooling',
    modules: [
      'language-node',
      'framework-express',
      'middleware-cors',
      'security-origin-checks',
      'security-helmet',
      'rate-limit',
      'middleware-morgan',
      'middleware-compression',
      'orm-prisma',
      'linter-eslint',
      'formatter-prettier',
      'quality-husky',
      'folder-clean'
    ]
  }
}

export function getPreset(name: string): PresetDefinition | undefined {
  return PRESETS[name]
}
