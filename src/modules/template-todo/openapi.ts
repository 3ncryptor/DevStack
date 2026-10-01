import type { SlotContribution } from '../../types/module'

/** OpenAPI entries for the todo routes (task 4.4), rendered into api-docs-scalar's document. */

const json = (schema: string): string =>
  `content: { 'application/json': { schema: { $ref: '#/components/schemas/${schema}' } } }`
const error = (status: string, description: string): string =>
  `'${status}': { description: '${description}', ${json('ErrorEnvelope')} }`
const idParam =
  "parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],"

function todoPaths(prefix: string): string {
  return `
'${prefix}/todos': {
  get: {
    summary: 'List todos, newest first (filters: completed, dueBefore; cursor pagination)',
    parameters: [
      { name: 'completed', in: 'query', schema: { enum: ['true', 'false'] } },
      { name: 'dueBefore', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
    ],
    responses: { '200': { description: 'A page of todos', ${json('TodoPage')} }, ${error('400', 'Invalid query')} }
  },
  post: {
    summary: 'Create a todo',
    requestBody: { required: true, ${json('TodoInput')} },
    responses: { '201': { description: 'Created', ${json('TodoEnvelope')} }, ${error('400', 'Invalid input')} }
  }
},
'${prefix}/todos/{id}': {
  get: { summary: 'One todo', ${idParam} responses: { '200': { description: 'The todo', ${json('TodoEnvelope')} }, ${error('404', 'No such todo')} } },
  patch: {
    summary: 'Change a todo',
    ${idParam}
    requestBody: { required: true, ${json('TodoInput')} },
    responses: { '200': { description: 'Changed', ${json('TodoEnvelope')} }, ${error('400', 'Invalid input')}, ${error('404', 'No such todo')} }
  },
  delete: { summary: 'Delete a todo', ${idParam} responses: { '200': { description: 'Deleted' }, ${error('404', 'No such todo')} } }
},
'${prefix}/todos/{id}/toggle': {
  post: { summary: 'Mark done or not done', ${idParam} responses: { '200': { description: 'Toggled', ${json('TodoEnvelope')} }, ${error('404', 'No such todo')} } }
},`
}

const TODO_SCHEMAS = `
Todo: {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', maxLength: 200 },
    completed: { type: 'boolean' },
    dueAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'title', 'completed', 'dueAt', 'createdAt', 'updatedAt']
},
TodoInput: {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    completed: { type: 'boolean' },
    dueAt: { type: ['string', 'null'], format: 'date-time' }
  }
},
TodoEnvelope: {
  type: 'object',
  properties: { success: { const: true }, data: { $ref: '#/components/schemas/Todo' } },
  required: ['success', 'data']
},
TodoPage: {
  type: 'object',
  properties: {
    success: { const: true },
    data: { type: 'array', items: { $ref: '#/components/schemas/Todo' } },
    meta: { type: 'object', properties: { nextCursor: { type: ['string', 'null'] } } }
  },
  required: ['success', 'data', 'meta']
},`

export const TODO_OPENAPI_SLOTS: readonly SlotContribution[] = [
  {
    slot: 'openapi.paths',
    code: todoPaths('/v1'),
    for: 'api-docs-scalar',
    when: { has: 'api-versioning' }
  },
  {
    slot: 'openapi.paths',
    code: todoPaths(''),
    for: 'api-docs-scalar',
    when: { not: { has: 'api-versioning' } }
  },
  { slot: 'openapi.schemas', code: TODO_SCHEMAS, for: 'api-docs-scalar' }
]
