import { Eta } from 'eta'

import type { LanguageAdapter } from '../../adapters/language/node'
import type { DockerCommands } from '../../adapters/package-manager/index'
import type { PlannedEnvVar } from '../../types/plan'
import type { ResolvedSettings } from '../settings'

/** An app of the project: folder (`apps/api`, or '' in the single layout), name and port. */
export interface AppInfo {
  dir: string
  name: string
  port: number
}

/** Only files ending in this suffix are rendered; the suffix is removed (D-10). */
export const TEMPLATE_SUFFIX = '.eta'

export interface TemplateContext {
  projectName: string
  packageManager: string
  /** Command lines for the project package manager (Dockerfile, docs). */
  pm: DockerCommands
  /** Language adapter values, e.g. `it.language.dockerBaseImage`. */
  language: LanguageAdapter
  /** Target being rendered: `root` in the single layout; `frontend` or `admin` for web apps. */
  target: string
  /** Port of the target being rendered (D-30): 3000 single, api 3001, web 3000, admin 3002. */
  port: number
  /** Script names of the target's package.json, e.g. which gates CI can run. */
  scripts: readonly string[]
  /** Installed version of the package manager (or a fallback in dry runs). */
  packageManagerVersion: string
  /** Catalog version ranges by package, e.g. `it.versions.turbo` for a Dockerfile. */
  versions: Readonly<Record<string, string>>
  /** Workspace package names by target, e.g. `it.packageNames.shared` (monorepo). */
  packageNames: Readonly<Record<string, string>>
  /**
   * Folder under `src/` that holds domain code (B17.6): `features` with feature-scoped
   * architecture, else `modules`. Template paths spell it `__domains__`.
   */
  domainsDir: string
  /** Selected module ids, e.g. for `it.modules.includes('orm-prisma')`. */
  modules: readonly string[]
  /** Env vars of the modules at this depth, e.g. for the generated `config/env.ts`. */
  env: readonly PlannedEnvVar[]
  /** Rendered slot output, keyed by slot name (e.g. `app.middleware`). */
  slots: Record<string, string>
  /** Resolved options of the module whose template is rendering (task 1.6). */
  options: Record<string, unknown>
  /** Resolved options of every selected module, e.g. the OAuth providers for login buttons. */
  moduleOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** Project settings (tasks 5.1-5.3), e.g. `it.settings.style`. */
  settings: ResolvedSettings
  /** The apps by role, e.g. `it.apps.backend.dir` (`apps/api`) and `it.apps.backend.port`. */
  apps: Readonly<Record<'backend' | 'frontend' | 'admin', AppInfo>>
}

// Templates render developer-controlled data into source code, so no HTML escaping; exact
// whitespace is kept and Prettier formats the result afterwards.
const eta = new Eta({ autoEscape: false, autoTrim: false, useWith: false, varName: 'it' })

/** Wraps a context object so reading an unknown key fails loudly instead of rendering blank. */
function strict<T extends object>(value: T, kind: string, templatePath: string): T {
  return new Proxy(value, {
    get(target, property, receiver) {
      if (typeof property === 'symbol' || Object.hasOwn(target, property)) {
        return Reflect.get(target, property, receiver) as unknown
      }
      throw new Error(`Template ${templatePath} uses unknown ${kind} "${property}".`)
    }
  })
}

export function renderTemplate(
  source: string,
  context: TemplateContext,
  templatePath: string
): string {
  const data = strict(
    {
      ...context,
      slots: strict(context.slots, 'slot', templatePath),
      options: strict(context.options, 'option', templatePath)
    },
    'variable',
    templatePath
  )
  try {
    return eta.renderString(source, data)
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Rendering ${templatePath} failed: ${reason}`, { cause: error })
  }
}
