import { moduleFilesPath } from '../../../../paths'
import type { DevstackModule } from '../../../../types/module'

/** Mongoose on MongoDB (M4, D-77): one connection, opened by the readiness check at startup. */
const moduleDefinition: DevstackModule = {
  id: 'orm-mongoose',
  title: 'Mongoose',
  category: 'orm',
  language: 'node',
  agentsMd: {
    storage:
      'Define the schema and register the model on `connection` from `src/db/client.ts`, then implement the repository with it.'
  },
  depth: 'bare',
  files: [{ path: 'src/db/client.ts', depth: 'wired' }],
  provides: ['orm'],
  description: 'Mongoose models on MongoDB',
  requires: ['language-node', 'database-mongodb'],
  dependencies: ['mongoose'],
  filesPath: moduleFilesPath('node/orm/mongoose'),
  slots: [
    {
      slot: 'lifecycle.imports',
      code: "import { checkDatabase, disconnectDatabase } from './db/client.js'",
      when: { has: 'core-backend' },
      depth: 'wired'
    },
    {
      slot: 'app.readiness',
      code: "{ name: 'db', check: checkDatabase },",
      when: { has: 'core-backend' },
      depth: 'wired'
    },
    {
      slot: 'app.shutdown',
      code: "{ name: 'db', dispose: disconnectDatabase },",
      when: { has: 'core-backend' },
      depth: 'wired'
    }
  ]
}

export default moduleDefinition
