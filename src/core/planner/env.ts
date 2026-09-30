import type { DevstackModule } from '../../types/module'
import type { PlannedEnvVar } from '../../types/plan'

/** Merges every module's env declarations; the first module to declare a variable owns its text. */
export function collectEnv(modules: readonly DevstackModule[]): PlannedEnvVar[] {
  const byName = new Map<string, PlannedEnvVar>()
  for (const moduleDefinition of modules) {
    for (const declaration of moduleDefinition.env ?? []) {
      const existing = byName.get(declaration.name)
      const warnings = declaration.warnIfUnset === undefined ? [] : [declaration.warnIfUnset]
      if (existing === undefined) {
        byName.set(declaration.name, {
          name: declaration.name,
          description: declaration.description,
          example: declaration.example,
          required: declaration.required,
          secret: declaration.secret ?? false,
          owners: [moduleDefinition.name],
          warnings
        })
        continue
      }
      byName.set(declaration.name, {
        ...existing,
        required: existing.required || declaration.required,
        secret: existing.secret || (declaration.secret ?? false),
        owners: [...existing.owners, moduleDefinition.name],
        warnings: [...existing.warnings, ...warnings]
      })
    }
  }
  return [...byName.values()]
}

/** The committed contract for configuration: every variable, grouped by its first module. */
export function envExample(env: readonly PlannedEnvVar[]): string {
  const lines = ['# Copy this file to .env and fill in the values. .env is never committed.']
  let currentOwner: string | undefined
  for (const variable of env) {
    const owner = variable.owners[0]
    if (owner !== currentOwner) {
      lines.push('', `# ${owner}`)
      currentOwner = owner
    }
    const flags = [
      variable.required ? 'required' : 'optional',
      ...(variable.secret ? ['secret'] : [])
    ]
    lines.push(`# ${variable.description} (${flags.join(', ')})`)
    lines.push(`${variable.name}=${variable.example ?? ''}`)
  }
  return `${lines.join('\n')}\n`
}
