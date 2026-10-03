import type { DevstackModule } from '../../../../types/module'

const moduleDefinition: DevstackModule = {
  id: 'api-versioning',
  title: 'API versioning (/v1)',
  category: 'api-style',
  language: 'node',
  agentsMd: {
    conventions: ['- Application routes live under `/v1`; `/health` and `/ready` stay unversioned.']
  },
  // the frameworks and web apps read it: routes under /v1, health and readiness unversioned
  description: 'Application routes under a /v1 URI prefix; /health and /ready stay unversioned',
  requiresAny: ['http-framework']
}

export default moduleDefinition
