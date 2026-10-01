import { randomBytes } from 'node:crypto'

import type { DevstackModule, EnvDeclaration } from '../../types/module'
import type { PlannedEnvVar } from '../../types/plan'

const defaultSchema = (declaration: EnvDeclaration): string =>
  declaration.required ? 'z.string().min(1)' : 'z.string().optional()'

/**
 * Merges every module's env declarations; the first module to declare a variable owns its text.
 * `include` drops declarations whose `when` does not hold for the stack.
 */
export function collectEnv(
  modules: readonly DevstackModule[],
  include: (moduleDefinition: DevstackModule, declaration: EnvDeclaration) => boolean = () => true
): PlannedEnvVar[] {
  const byName = new Map<string, PlannedEnvVar>()
  for (const moduleDefinition of modules) {
    for (const declaration of moduleDefinition.env ?? []) {
      if (!include(moduleDefinition, declaration)) continue
      const existing = byName.get(declaration.name)
      const warnings = declaration.warnIfUnset === undefined ? [] : [declaration.warnIfUnset]
      if (existing === undefined) {
        byName.set(declaration.name, {
          name: declaration.name,
          description: declaration.description,
          example: declaration.example,
          required: declaration.required,
          secret: declaration.secret ?? false,
          generated: declaration.generate === 'secret',
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
        generated: existing.generated || declaration.generate === 'secret',
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
    // a generated secret is never written to the committed file, not even as an example
    lines.push(`${variable.name}=${variable.generated ? '' : (variable.example ?? '')}`)
  }
  return `${lines.join('\n')}\n`
}

/** A random local secret: 32 bytes, URL-safe base64 (no quoting needed in .env). */
export const randomSecret = (): string => randomBytes(32).toString('base64url')

/**
 * Local development values (B17.7, D-31): each variable's example, which is a local default, or
 * a random value for a generated secret. `secret` is injected so plans can be reproduced in tests.
 */
export function dotEnv(env: readonly PlannedEnvVar[], secret: () => string = randomSecret): string {
  const value = (variable: PlannedEnvVar): string | undefined =>
    variable.generated ? secret() : variable.example
  const lines = [
    '# Local development only; never commit this file. Production sets these in its environment.',
    ...env.map((variable) => {
      const local = value(variable)
      return local === undefined ? `# ${variable.name}=` : `${variable.name}=${local}`
    })
  ]
  return `${lines.join('\n')}\n`
}
