import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

/**
 * Server-side sessions in Redis (M4, D-78) on top of auth-jwt: the access token is an opaque
 * session id looked up in Redis instead of a JWT, so logout, and a reused refresh token, end
 * sessions at once. Register, login, refresh, cookies and routes stay auth-jwt's.
 */
const moduleDefinition: DevstackModule = {
  id: 'auth-session',
  title: 'Sessions in Redis',
  category: 'security',
  language: 'node',
  wizard: {
    question: 'auth',
    order: 2,
    label: 'Email + password (sessions in Redis)',
    hint: 'like JWT, but logout ends the session at once; adds Redis'
  },
  description:
    'Opaque session ids in Redis instead of JWT access tokens: logout and a reused refresh token end sessions at once',
  requires: ['auth-jwt', 'cache-redis'],
  filesPath: moduleFilesPath('node/auth/session'),
  slots: [
    {
      slot: 'index.imports',
      code: [
        "import { createSessionTokens } from './__domains__/auth/session-tokens.js'",
        "import { redisSessionStore } from './cache/session-store.redis.js'"
      ].join('\n')
    },
    {
      slot: 'index.deps',
      code: [
        'auth: createAuthService({',
        '  ...prismaAuthRepositories,',
        '  config: authConfig(env),',
        '  accessTokens: createSessionTokens(redisSessionStore, env.JWT_ACCESS_TTL_MINUTES)',
        '}),'
      ].join('\n')
    }
  ]
}

export default moduleDefinition
