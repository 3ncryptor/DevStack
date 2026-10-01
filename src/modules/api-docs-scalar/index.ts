import { moduleFilesPath } from '../../paths'
import type { DevstackModule } from '../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'api-docs-scalar',
  title: 'API docs (Scalar)',
  category: 'api-docs',
  language: 'node',
  description: 'OpenAPI document at /openapi.json and a Scalar API reference at /docs',
  // Nest uses @nestjs/swagger for its document; that variant comes later (task 4.4)
  requires: ['framework-express'],
  dependencies: ['@scalar/express-api-reference'],
  slots: [
    {
      slot: 'app.imports',
      code: "import { createDocsRouter, docsEnabled } from './routes/docs.js'"
    },
    // before the security headers: the reference loads its script from a CDN that a strict
    // Content-Security-Policy would block
    { slot: 'app.middleware', code: 'if (docsEnabled) app.use(createDocsRouter())', order: 25 }
  ],
  env: [
    {
      name: 'API_DOCS',
      description: 'Serve /docs and /openapi.json in production too (always on in development)',
      required: false,
      schema: "z.enum(['true', 'false']).optional()"
    }
  ],
  filesPath: moduleFilesPath('api-docs-scalar')
}

export default moduleDefinition
