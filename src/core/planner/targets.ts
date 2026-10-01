import type { DevstackModule, ModuleTarget } from '../../types/module'
import type { PlannedEnvVar } from '../../types/plan'
import { projectDirectoryName } from '../project-name'

/** Capability tag of the monorepo layout module. */
export const MONOREPO_TAG = 'layout:monorepo'

/** Where each target lives in a monorepo (B8). The single layout puts everything at the root. */
export const MONOREPO_DIRS: Readonly<Record<ModuleTarget, string>> = {
  root: '',
  backend: 'apps/api',
  frontend: 'apps/web',
  shared: 'packages/shared'
}

/** Ports for a monorepo, defined once (D-30): web 3000, api 3001. */
export const MONOREPO_PORTS: Readonly<Partial<Record<ModuleTarget, number>>> = {
  backend: 3001,
  frontend: 3000
}

export interface Target {
  role: ModuleTarget
  /** Project-relative directory, '' for the root. */
  dir: string
  /** Package name in the workspace. */
  packageName: string
  modules: DevstackModule[]
}

export const isMonorepo = (modules: readonly DevstackModule[]): boolean =>
  modules.some((moduleDefinition) => (moduleDefinition.provides ?? []).includes(MONOREPO_TAG))

export const targetOf = (moduleDefinition: DevstackModule): ModuleTarget =>
  moduleDefinition.target ?? 'backend'

/** A project-relative path inside a target directory. */
export const inTarget = (dir: string, filePath: string): string =>
  dir === '' ? filePath : `${dir}/${filePath}`

/**
 * Splits the stack into targets. Single layout: one root target with every module (D-03), so
 * output is unchanged. Monorepo: one target per role that has modules; the root always exists.
 */
export function planTargets(projectName: string, modules: readonly DevstackModule[]): Target[] {
  if (!isMonorepo(modules)) {
    return [{ role: 'root', dir: '', packageName: projectName, modules: [...modules] }]
  }
  const scope = projectDirectoryName(projectName)
  return (Object.keys(MONOREPO_DIRS) as ModuleTarget[])
    .map((role) => ({
      role,
      dir: MONOREPO_DIRS[role],
      packageName: role === 'root' ? projectName : `@${scope}/${MONOREPO_DIRS[role].split('/')[1]}`,
      modules: modules.filter((moduleDefinition) => targetOf(moduleDefinition) === role)
    }))
    .filter((target) => target.role === 'root' || target.modules.length > 0)
}

/** A target's env with its monorepo port, so two apps never fight over one. */
export function envForTarget(
  target: Target,
  env: readonly PlannedEnvVar[],
  monorepo: boolean
): PlannedEnvVar[] {
  const port = monorepo ? MONOREPO_PORTS[target.role] : undefined
  if (port === undefined) return [...env]
  return env.map((variable) =>
    variable.name === 'PORT' ? { ...variable, example: String(port) } : variable
  )
}
