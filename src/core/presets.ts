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
      'database-postgres',
      'orm-prisma',
      'quality-eslint',
      'quality-prettier',
      'quality-husky',
      'arch-clean'
    ]
  },
  // the M2 vertical slice (D-47): every recommended answer for a fullstack app
  'fullstack-next-express': {
    name: 'fullstack-next-express',
    description:
      'Express + Prisma + Next.js + Tailwind monorepo, with Docker, CI, API docs and tests',
    modules: [
      'language-node',
      'layout-monorepo',
      'framework-express',
      'arch-feature',
      'database-postgres',
      'orm-prisma',
      'security-helmet',
      'middleware-cors',
      'security-rate-limit',
      'middleware-request-logger',
      'api-versioning',
      'api-docs-scalar',
      'framework-nextjs',
      'ui-tailwind',
      'arch-web-feature',
      'testing-vitest',
      'testing-vitest-web',
      'devops-docker',
      'devops-docker-web',
      'devops-github-actions',
      'quality-eslint',
      'quality-prettier',
      'quality-husky',
      'repo-agents-md',
      'repo-vscode',
      'repo-github-hygiene'
    ]
  }
}

export function getPreset(name: string): PresetDefinition | undefined {
  return PRESETS[name]
}
