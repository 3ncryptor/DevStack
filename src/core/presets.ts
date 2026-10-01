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
      'security-rate-limit',
      'middleware-request-logger',
      'middleware-compression',
      'orm-prisma',
      'quality-eslint',
      'quality-prettier',
      'quality-husky',
      'arch-clean'
    ]
  }
}

export function getPreset(name: string): PresetDefinition | undefined {
  return PRESETS[name]
}
