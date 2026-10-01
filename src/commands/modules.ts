import { InputError } from '../errors'
import { MODULE_CATEGORIES, type DevstackModule, type ModuleCategory } from '../types/module'

export interface ListModulesOptions {
  category?: string
  json?: boolean
}

const ID_WIDTH = 28

function assertCategory(category: string): ModuleCategory {
  const known = MODULE_CATEGORIES.find((candidate) => candidate === category)
  if (known === undefined) {
    throw new InputError(
      `Unknown category "${category}". Categories: ${MODULE_CATEGORIES.join(', ')}.`
    )
  }
  return known
}

/** `modules list`: the registry as text grouped by category, or as JSON. */
export function listModules(
  registry: ReadonlyMap<string, DevstackModule>,
  options: ListModulesOptions
): string {
  const category = options.category === undefined ? undefined : assertCategory(options.category)
  const modules = [...registry.values()]
    .filter((moduleDefinition) => category === undefined || moduleDefinition.category === category)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (options.json === true) {
    const rows = modules.map((moduleDefinition) => ({
      id: moduleDefinition.id,
      title: moduleDefinition.title,
      description: moduleDefinition.description,
      category: moduleDefinition.category,
      provides: [...(moduleDefinition.provides ?? [])]
    }))
    return `${JSON.stringify(rows, null, 2)}\n`
  }

  const sections = MODULE_CATEGORIES.flatMap((name) => {
    const inCategory = modules.filter((moduleDefinition) => moduleDefinition.category === name)
    if (inCategory.length === 0) return []
    return [
      [
        name,
        ...inCategory.map(
          (moduleDefinition) =>
            `  ${moduleDefinition.id.padEnd(ID_WIDTH)} ${moduleDefinition.title}`
        )
      ].join('\n')
    ]
  })
  return `${sections.join('\n\n')}\n`
}
