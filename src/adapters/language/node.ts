import { nodeCatalog } from '../../catalog/node'
import type { LanguageAdapter } from './index'

export const NODE_LANGUAGE: LanguageAdapter = {
  id: 'node',
  catalog: nodeCatalog,
  dockerBaseImage: 'node:24-alpine'
}
