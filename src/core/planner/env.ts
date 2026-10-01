import type { DevstackModule, EnvDeclaration } from '../../types/module'
import type { PlannedEnvVar } from '../../types/plan'

const defaultSchema = (declaration: EnvDeclaration): string =>
  declaration.required ? 'z.string().min(1)' : 'z.string().optional()'

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
          schema: declaration.schema ?? defaultSchema(declaration),
          owners: [moduleDefinition.id],
          warnings
        })
        continue
      }
      byName.set(declaration.name, {
        ...existing,
        required: existing.required || declaration.required,
        secret: existing.secret || (declaration.secret ?? false),
        owners: [...existing.owners, moduleDefinition.id],
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

/** Local development values (B17.7, D-31): each variable's example, which is a local default. */
export function dotEnv(env: readonly PlannedEnvVar[]): string {
  const lines = [
    '# Local development only; never commit this file. Production sets these in its environment.',
    ...env.map((variable) =>
      variable.example === undefined
        ? `# ${variable.name}=`
        : `${variable.name}=${variable.example}`
    )
  ]
  return `${lines.join('\n')}\n`
}
