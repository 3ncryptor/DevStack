import type { SlotContribution } from '../../types/module'

/** OpenAPI entries for the auth routes (task 4.4), rendered into api-docs-scalar's document. */

const json = (schema: string): string =>
  `content: { 'application/json': { schema: { $ref: '#/components/schemas/${schema}' } } }`

const error = (status: string, description: string): string =>
  `'${status}': { description: '${description}', ${json('ErrorEnvelope')} }`

function authPaths(prefix: string): string {
  return `
'${prefix}/auth/register': {
  post: {
    summary: 'Create an account and start a session (sets httpOnly session cookies)',
    requestBody: { required: true, ${json('RegisterInput')} },
    responses: {
      '201': { description: 'Registered and logged in', ${json('SessionEnvelope')} },
      ${error('400', 'Invalid input')},
      ${error('403', 'Origin not allowed')},
      ${error('409', 'Email already registered')},
      ${error('429', 'Too many attempts')}
    }
  }
},
'${prefix}/auth/login': {
  post: {
    summary: 'Start a session (sets httpOnly session cookies)',
    requestBody: { required: true, ${json('LoginInput')} },
    responses: {
      '200': { description: 'Logged in', ${json('SessionEnvelope')} },
      ${error('400', 'Invalid input')},
      ${error('401', 'Email or password is incorrect')},
      ${error('403', 'Origin not allowed')},
      ${error('429', 'Too many attempts')}
    }
  }
},
'${prefix}/auth/refresh': {
  post: {
    summary:
      'Rotate the refresh token cookie and issue a new access token cookie; a reused refresh token ends every session of its user',
    responses: {
      '200': { description: 'New session', ${json('SessionEnvelope')} },
      ${error('401', 'No valid session (the session cookies are cleared)')},
      ${error('403', 'Origin not allowed')}
    }
  }
},
'${prefix}/auth/logout': {
  post: {
    summary: 'End the session: revoke the refresh token and clear the cookies',
    responses: {
      '200': { description: 'Logged out' },
      ${error('403', 'Origin not allowed')}
    }
  }
},
'${prefix}/auth/me': {
  get: {
    summary: 'The current user (access token cookie or Bearer header)',
    responses: {
      '200': { description: 'The current user', ${json('UserEnvelope')} },
      ${error('401', 'Not logged in')}
    }
  }
},`
}

const AUTH_SCHEMAS = `
User: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: ['string', 'null'] },
    role: { enum: ['USER', 'ADMIN'] },
    createdAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'email', 'name', 'role', 'createdAt']
},
RegisterInput: {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    name: { type: 'string', maxLength: 100 }
  },
  required: ['email', 'password']
},
LoginInput: {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', maxLength: 128 }
  },
  required: ['email', 'password']
},
SessionEnvelope: {
  type: 'object',
  properties: {
    success: { const: true },
    data: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        accessTokenExpiresAt: { type: 'string', format: 'date-time' }
      },
      required: ['user', 'accessTokenExpiresAt']
    }
  },
  required: ['success', 'data']
},
UserEnvelope: {
  type: 'object',
  properties: {
    success: { const: true },
    data: {
      type: 'object',
      properties: { user: { $ref: '#/components/schemas/User' } },
      required: ['user']
    }
  },
  required: ['success', 'data']
},`

export const AUTH_OPENAPI_SLOTS: readonly SlotContribution[] = [
  {
    slot: 'openapi.paths',
    code: authPaths('/v1'),
    for: 'api-docs-scalar',
    when: { has: 'api-versioning' }
  },
  {
    slot: 'openapi.paths',
    code: authPaths(''),
    for: 'api-docs-scalar',
    when: { not: { has: 'api-versioning' } }
  },
  { slot: 'openapi.schemas', code: AUTH_SCHEMAS, for: 'api-docs-scalar' }
]
