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
  },
  // M4 breadth (D-80): one preset per framework and frontend, each resolved and tested end to end
  'backend-fastify': {
    name: 'backend-fastify',
    description:
      'TypeScript + Fastify + Drizzle + PostgreSQL, with Docker, tests and quality tooling',
    modules: [
      'language-node',
      'framework-fastify',
      'middleware-cors',
      'security-origin-checks',
      'security-helmet',
      'security-rate-limit',
      'middleware-request-logger',
      'middleware-compression',
      'database-postgres',
      'orm-drizzle',
      'api-versioning',
      'api-docs-scalar',
      'testing-vitest',
      'devops-docker',
      'quality-eslint',
      'quality-prettier',
      'quality-husky',
      'arch-feature'
    ]
  },
  'backend-nest': {
    name: 'backend-nest',
    description:
      'TypeScript + NestJS + Prisma + PostgreSQL with JWT auth, Jest, Docker and quality tooling',
    modules: [
      'language-node',
      'framework-nest',
      'middleware-cors',
      'security-helmet',
      'security-rate-limit',
      'database-postgres',
      'orm-prisma',
      'auth-jwt',
      'api-docs-scalar',
      'testing-jest',
      'devops-docker',
      'quality-eslint',
      'quality-prettier',
      'quality-husky'
    ]
  },
  'api-mongo': {
    name: 'api-mongo',
    description:
      'TypeScript + Express + Mongoose on MongoDB, with Redis, Docker and quality tooling',
    modules: [
      'language-node',
      'framework-express',
      'middleware-cors',
      'security-helmet',
      'security-rate-limit',
      'middleware-request-logger',
      'database-mongodb',
      'orm-mongoose',
      'cache-redis',
      'testing-vitest',
      'devops-docker',
      'quality-eslint',
      'quality-prettier',
      'quality-husky',
      'arch-feature'
    ]
  },
  'fullstack-vite-express': {
    name: 'fullstack-vite-express',
    description:
      'Express + Prisma + React + Vite + Tailwind monorepo, with auth, Docker, CI, API docs and tests',
    modules: [
      'language-node',
      'layout-monorepo',
      'framework-express',
      'arch-feature',
      'database-postgres',
      'orm-prisma',
      'auth-jwt',
      'security-helmet',
      'middleware-cors',
      'security-rate-limit',
      'middleware-request-logger',
      'api-versioning',
      'api-docs-scalar',
      'framework-react-vite',
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
