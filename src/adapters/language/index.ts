import type { VersionCatalog } from '../../catalog/catalog'
import type { DevstackModule, LanguageId } from '../../types/module'
import { NODE_LANGUAGE } from './node'

/**
 * What core needs from a language (buildPlan B7, D-96): its version catalog and its Docker base
 * image. It grows only when a second language needs a method (D-21).
 */
export interface LanguageAdapter {
  id: LanguageId
  catalog: VersionCatalog
  /** Base image for generated Dockerfiles; follows the generated engines (D-09). */
  dockerBaseImage: string
}

export const LANGUAGES: Readonly<Record<LanguageId, LanguageAdapter>> = { node: NODE_LANGUAGE }

/** The language of a stack: its language module's (every stack has one, e.g. language-node). */
export function languageOf(modules: readonly DevstackModule[]): LanguageAdapter {
  const language =
    modules.find((moduleDefinition) => moduleDefinition.category === 'language') ?? modules[0]
  return LANGUAGES[language?.language ?? 'node']
}
