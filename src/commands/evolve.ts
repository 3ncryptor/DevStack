import { runPlanCommands, type CommandOutput } from '../core/apply/commands'
import { applyChanges, type EvolveOutcome } from '../core/evolve/apply'
import {
  planProject,
  readProjectStack,
  versionNote,
  type ProjectStack
} from '../core/evolve/project'
import { pathOf, reconcile, sidecarPath, type Change } from '../core/evolve/reconcile'
import { loadModules } from '../core/module-loader'
import { InputError } from '../errors'
import { canonicalModuleId } from '../modules/aliases'
import type { DevstackModule } from '../types/module'
import type { GenerationPlan } from '../types/plan'
import type { Logger } from '../utils/logger'

export interface EvolveOptions {
  projectDir: string
  /** List the changes and stop. */
  dryRun: boolean
  /** Overwrite files the user edited (originals backed up) instead of writing sidecars. */
  force: boolean
  skipInstall: boolean
  logger: Logger
  /** stderr when stdout is not the user's terminal (MCP). */
  commandOutput?: CommandOutput
}

export interface EvolveResult {
  /** The modules the stack has afterwards. */
  modules: string[]
  changes: Change[]
  outcome?: EvolveOutcome
  /** Human-readable report. */
  report: string
}

const MARKS: Record<Change['kind'], string> = {
  create: '+',
  update: '~',
  merge: '±',
  delete: '-',
  conflict: '!',
  skip: '='
}

function describeMerge(change: Extract<Change, { kind: 'merge' }>): string {
  if (change.added !== undefined) return ` (added ${change.added.join(', ')})`
  return change.kept.length > 0 ? ` (kept your ${change.kept.join(', ')})` : ''
}

function describe(change: Change, force: boolean): string {
  const at = `${MARKS[change.kind]} ${pathOf(change)}`
  if (change.kind === 'merge') return `${at}${describeMerge(change)}`
  if (change.kind === 'skip') return `${at} (${change.reason})`
  if (change.kind !== 'conflict') return at
  const whose = change.reason === 'edited' ? 'you edited it' : 'already yours'
  return force
    ? `${at} (${whose}; overwritten, original backed up)`
    : `${at} (${whose}; new version in ${sidecarPath(change.file.path)})`
}

function report(
  stack: ProjectStack,
  verb: string,
  changes: readonly Change[],
  options: EvolveOptions,
  outcome: EvolveOutcome | undefined
): string {
  const note = versionNote(stack)
  const env = changes.flatMap((change) =>
    change.kind === 'merge' && change.added !== undefined && pathOf(change).endsWith('.env')
      ? [
          `New variables in ${pathOf(change)}, with local defaults (secrets generated): ${change.added.join(', ')}. Check them before deploying.`
        ]
      : []
  )
  const conflicts = changes.some((change) => change.kind === 'conflict')
  return [
    ...(note === undefined ? [] : [note, '']),
    changes.length === 0 ? 'No file changes.' : `${verb}:`,
    ...changes.map((change) => `  ${describe(change, options.force)}`),
    ...(options.dryRun ? ['', 'Dry run: nothing was written.'] : []),
    ...(conflicts && !options.force
      ? ['', 'Merge each .devstack-new file into the file next to it, then delete it.']
      : []),
    ...(outcome?.backupDir === undefined ? [] : [`Originals backed up in ${outcome.backupDir}`]),
    ...env,
    ''
  ].join('\n')
}

async function applyAndInstall(
  newPlan: GenerationPlan,
  changes: Change[],
  added: readonly string[],
  options: EvolveOptions
): Promise<EvolveOutcome | undefined> {
  if (options.dryRun) return undefined
  const outcome = await applyChanges(newPlan, changes, { force: options.force })
  if (!options.skipInstall) {
    // install updates the lockfile. Post-install steps regenerate code from the project's files
    // (prisma generate after auth adds the User model), so they all run again; other steps run
    // for the new modules only
    const commands = newPlan.commands.filter(
      (command) =>
        command.phase === 'install' ||
        command.phase === 'postInstall' ||
        (command.module !== undefined && added.includes(command.module))
    )
    await runPlanCommands({ ...newPlan, commands }, options.logger, options.commandOutput)
  }
  return outcome
}

function knownIds(ids: readonly string[], registry: Map<string, DevstackModule>): string[] {
  return ids.map((requested) => {
    const id = canonicalModuleId(requested)
    if (!registry.has(id)) {
      throw new InputError(`Unknown module: ${requested}. See them all with: modules list`)
    }
    return id
  })
}

/** `add <module...>` (task 5.6): the stack plus these modules, applied to the project. */
export async function addModules(
  ids: readonly string[],
  options: EvolveOptions
): Promise<EvolveResult> {
  const registry = loadModules()
  const stack = await readProjectStack(options.projectDir)
  const requested = knownIds(ids, registry).filter((id) => !stack.modules.includes(id))
  if (requested.length === 0) {
    throw new InputError(`Already in the stack: ${ids.join(', ')}.`)
  }
  const oldPlan = await planProject(stack, stack.modules, stack.moduleOptions, registry)
  const newPlan = await planProject(
    stack,
    [...stack.modules, ...requested],
    stack.moduleOptions,
    registry
  )
  // modules a new one requires come along (B5); they are new too
  const added = newPlan.modules.filter((id) => !stack.modules.includes(id))
  const changes = await reconcile(oldPlan, newPlan, `add ${added.join(' ')}`)
  const outcome = await applyAndInstall(newPlan, changes, added, options)
  return {
    modules: newPlan.modules,
    changes,
    ...(outcome === undefined ? {} : { outcome }),
    report: report(stack, `Adding ${added.join(', ')}`, changes, options, outcome)
  }
}

/** Modules that still need `id`; it cannot go while they stay. */
function dependents(
  id: string,
  remaining: readonly string[],
  registry: Map<string, DevstackModule>
): string[] {
  return remaining.filter((other) => registry.get(other)?.requires?.includes(id) === true)
}

/** `remove <module...>` (task 5.8): the stack without these modules, applied to the project. */
export async function removeModules(
  ids: readonly string[],
  options: EvolveOptions
): Promise<EvolveResult> {
  const registry = loadModules()
  const stack = await readProjectStack(options.projectDir)
  const requested = knownIds(ids, registry)
  const missing = requested.filter((id) => !stack.modules.includes(id))
  if (missing.length > 0) throw new InputError(`Not in the stack: ${missing.join(', ')}.`)
  const remaining = stack.modules.filter((id) => !requested.includes(id))
  for (const id of requested) {
    const needing = dependents(id, remaining, registry)
    if (needing.length > 0) {
      throw new InputError(`${id} is required by ${needing.join(', ')}; remove those first.`)
    }
  }
  const keptOptions = Object.fromEntries(
    Object.entries(stack.moduleOptions).filter(([id]) => !requested.includes(id))
  )
  const oldPlan = await planProject(stack, stack.modules, stack.moduleOptions, registry)
  const newPlan = await planProject(stack, remaining, keptOptions, registry)
  const changes = await reconcile(oldPlan, newPlan, `remove ${requested.join(' ')}`)
  const outcome = await applyAndInstall(newPlan, changes, [], options)
  return {
    modules: newPlan.modules,
    changes,
    ...(outcome === undefined ? {} : { outcome }),
    report: report(stack, `Removing ${requested.join(', ')}`, changes, options, outcome)
  }
}
