import { moduleFilesPath } from '../../../../paths'
import type { Condition, DevstackModule } from '../../../../types/module'

const FASTIFY: Condition = { has: 'http:fastify' }
const CONNECT: Condition = { has: 'http:connect' }

const moduleDefinition: DevstackModule = {
  id: 'api-docs-scalar',
  title: 'API docs (Scalar)',
  category: 'api-docs',
  language: 'node',
  description: 'OpenAPI document at /openapi.json and a Scalar API reference at /docs',
  // Nest uses @nestjs/swagger for its document; that variant comes later (task 4.4)
  // Nest runs on Express, so it serves the same Scalar reference and OpenAPI document (D-74)
  requiresAny: ['http:express', 'http:fastify', 'http:nest'],
  dependencies: [
    { name: '@scalar/express-api-reference', when: CONNECT },
    // the docs router imports express at runtime; in a Nest project it is otherwise only transitive
    { name: 'express', when: { has: 'http:nest' } },
    { name: '@scalar/fastify-api-reference', when: FASTIFY }
  ],
  // other modules document their routes here (e.g. auth-jwt)
  exposesSlots: ['openapi.paths', 'openapi.schemas'],
  slots: [
    {
      slot: 'app.imports',
      code: "import { createDocsRouter, docsEnabled } from './routes/docs.js'",
      when: CONNECT
    },
    // before the security headers: the reference loads its script from a CDN that a strict
    // Content-Security-Policy would block
    {
      slot: 'app.middleware',
      code: 'if (docsEnabled) app.use(createDocsRouter())',
      order: 25,
      when: CONNECT
    },
    {
      slot: 'app.imports',
      code: "import { docsEnabled, registerDocs } from './plugins/docs.js'",
      when: FASTIFY
    },
    {
      slot: 'app.plugins',
      code: 'if (docsEnabled) await registerDocs(app)',
      order: 25,
      when: FASTIFY
    }
  ],
  env: [
    {
      name: 'API_DOCS',
      description: 'Serve /docs and /openapi.json in production too (always on in development)',
      required: false,
      schema: "z.enum(['true', 'false']).optional()"
    }
  ],
  files: [
    { path: 'src/routes/docs.ts', when: CONNECT },
    { path: 'src/plugins/docs.ts', when: FASTIFY }
  ],
  filesPath: moduleFilesPath('node/api/docs-scalar')
}

export default moduleDefinition
