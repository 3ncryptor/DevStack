import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

/** Redis (M4, D-77): one client with backoff reconnects, a readiness check and a clean shutdown. */
const moduleDefinition: DevstackModule = {
  id: 'cache-redis',
  title: 'Redis',
  category: 'cache',
  language: 'node',
  depth: 'bare',
  files: [{ path: 'src/cache/redis.ts', depth: 'wired' }],
  provides: ['cache', 'cache:redis'],
  description: 'A Redis client for caching, rate limits and sessions, with a compose service',
  requires: ['language-node'],
  dependencies: ['redis'],
  filesPath: moduleFilesPath('cache-redis'),
  scripts: [
    { name: 'redis:up', run: 'docker compose up -d redis', when: { has: 'devops-docker' } }
  ],
  slots: [
    {
      slot: 'lifecycle.imports',
      code: "import { checkRedis, disconnectRedis } from './cache/redis.js'",
      when: { has: 'core-backend' },
      depth: 'wired'
    },
    {
      slot: 'app.readiness',
      code: "{ name: 'redis', check: checkRedis },",
      when: { has: 'core-backend' },
      depth: 'wired'
    },
    {
      slot: 'app.shutdown',
      code: "{ name: 'redis', dispose: disconnectRedis },",
      when: { has: 'core-backend' },
      depth: 'wired'
    }
  ],
  env: [
    {
      name: 'REDIS_URL',
      description: 'Redis connection string',
      example: '"redis://localhost:6379"',
      required: true,
      secret: true,
      schema: 'z.url()'
    }
  ]
}

export default moduleDefinition
