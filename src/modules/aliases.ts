/**
 * Module ids are stable forever (buildPlan B4); a renamed module keeps its old id here so configs,
 * presets and manifests that use it still resolve. Renamed for contract v2 on 2026-10-01.
 */
export const MODULE_ALIASES: Readonly<Record<string, string>> = {
  'folder-clean': 'arch-clean',
  'folder-mvc': 'arch-mvc',
  'linter-eslint': 'quality-eslint',
  'formatter-prettier': 'quality-prettier',
  'middleware-morgan': 'middleware-request-logger',
  'rate-limit': 'security-rate-limit',
  'docker-basic': 'devops-docker'
}

/** The current id for `id`, following an alias when it has been renamed. */
export function canonicalModuleId(id: string): string {
  return MODULE_ALIASES[id] ?? id
}
