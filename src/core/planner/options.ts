import { z } from 'zod'

import { InputError } from '../../errors'
import { canonicalModuleId } from '../../modules/aliases'
import type { DevstackModule } from '../../types/module'

/** Validated options per module id, defaults filled in. Only modules with an options schema appear. */
export type ResolvedModuleOptions = Readonly<Record<string, Record<string, unknown>>>

/**
 * Validates the options given for each module against its schema (task 1.6). Options for a module
 * that is not selected, or that has no options, are errors rather than being silently ignored.
 */
export function resolveModuleOptions(
  modules: readonly DevstackModule[],
  raw: Readonly<Record<string, unknown>>
): ResolvedModuleOptions {
  const byId = new Map(modules.map((moduleDefinition) => [moduleDefinition.id, moduleDefinition]))
  for (const requested of Object.keys(raw)) {
    const moduleDefinition = byId.get(canonicalModuleId(requested))
    if (moduleDefinition === undefined) {
      throw new InputError(
        `Options were given for "${requested}", but that module is not selected.`
      )
    }
    if (moduleDefinition.options === undefined) {
      throw new InputError(`Options were given for "${requested}", but that module has no options.`)
    }
  }

  const given = Object.fromEntries(
    Object.entries(raw).map(([id, value]) => [canonicalModuleId(id), value])
  )
  const resolved: Record<string, Record<string, unknown>> = {}
  for (const moduleDefinition of modules) {
    if (moduleDefinition.options === undefined) continue
    const parsed = moduleDefinition.options.safeParse(given[moduleDefinition.id] ?? {})
    if (!parsed.success) {
      throw new InputError(
        `Invalid options for "${moduleDefinition.id}":\n${z.prettifyError(parsed.error)}`
      )
    }
    resolved[moduleDefinition.id] = parsed.data
  }
  return resolved
}
