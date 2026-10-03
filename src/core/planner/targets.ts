import type { DevstackModule, ModuleTarget } from '../../types/module'
import type { PlannedEnvVar } from '../../types/plan'
import { projectDirectoryName } from '../project-name'
import { portFor, type ResolvedSettings } from '../settings'

/** Capability tag of the monorepo layout module. */
export const MONOREPO_TAG = 'layout:monorepo'

/**
 * Where each target lives in a monorepo (B8): apps/<name> with the names from the settings
 * (default api, web, admin). The single layout puts everything at the root.
 */
export function monorepoDirs(settings: ResolvedSettings): Readonly<Record<ModuleTarget, string>> {
  return {
    root: '',
    backend: `apps/${settings.apps.backend}`,
    frontend: `apps/${settings.apps.frontend}`,
    admin: `apps/${settings.apps.admin}`,
    shared: 'packages/shared'
  }
}

/** Web apps: the main one, and the admin app built from the same frontend modules (D-64). */
export const WEB_ROLES: readonly ModuleTarget[] = ['frontend', 'admin']

/** Port of a target, for scripts and env defaults (D-30, or the settings' choice). */
export const portOf = (
  role: ModuleTarget,
  monorepo: boolean,
  settings: ResolvedSettings
): number =>
  role === 'frontend' || role === 'admin'
    ? portFor(settings, role, monorepo)
    : portFor(settings, 'backend', monorepo)

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
export function planTargets(
  projectName: string,
  modules: readonly DevstackModule[],
  settings: ResolvedSettings
): Target[] {
  if (!isMonorepo(modules)) {
    return [{ role: 'root', dir: '', packageName: projectName, modules: [...modules] }]
  }
  const scope = projectDirectoryName(projectName)
  const dirs = monorepoDirs(settings)
  return (Object.keys(dirs) as ModuleTarget[])
    .map((role) => ({
      role,
      dir: dirs[role],
      packageName: role === 'root' ? projectName : `@${scope}/${dirs[role].split('/')[1]}`,
      modules: modules.filter(
        (moduleDefinition) =>
          targetOf(moduleDefinition) === role ||
          // the admin app reuses every frontend module: Next.js, styling, folders
          (role === 'admin' && targetOf(moduleDefinition) === 'frontend')
      )
    }))
    .filter(
      (target) =>
        target.role === 'root' ||
        (target.role === 'admin'
          ? target.modules.some((moduleDefinition) => targetOf(moduleDefinition) === 'admin')
          : target.modules.length > 0)
    )
}

/**
 * A target's env with monorepo defaults: each app its own port (D-30), and the API's CORS
 * allowlist set to the web app's origin when there is one (D-29: never `*`).
 */
export function envForTarget(
  target: Target,
  env: readonly PlannedEnvVar[],
  targets: readonly Target[],
  settings: ResolvedSettings
): PlannedEnvVar[] {
  if (target.dir === '') {
    // the single app serves on its port: 3000, or the one the settings chose
    const port = portOf('backend', false, settings).toString()
    return env.map((variable) =>
      variable.name === 'PORT' ? { ...variable, example: port } : variable
    )
  }
  const webOrigins = targets
    .filter((candidate) => WEB_ROLES.includes(candidate.role))
    .map((candidate) => `http://localhost:${portOf(candidate.role, true, settings)}`)
  const overrides: Record<string, string | undefined> = {
    PORT: ['backend', 'frontend', 'admin'].includes(target.role)
      ? portOf(target.role, true, settings).toString()
      : undefined,
    ALLOWED_ORIGINS:
      target.role === 'backend' && webOrigins.length > 0 ? webOrigins.join(',') : undefined,
    // the web apps reach the API on its port (D-30, or the settings' choice)
    API_URL: WEB_ROLES.includes(target.role)
      ? `http://localhost:${portOf('backend', true, settings)}`
      : undefined
  }
  return env.map((variable) => {
    const example = overrides[variable.name]
    // a value DevStack fills in is not "left empty", so its unset-warning no longer applies
    return example === undefined ? variable : { ...variable, example, warnings: [] }
  })
}

/** How a workspace package depends on another, per package manager. */
export const workspaceRange = (packageManager: string): string =>
  packageManager === 'pnpm' || packageManager === 'bun' ? 'workspace:*' : '*'
