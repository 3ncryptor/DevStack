/**
 * pnpm >= 11 fails the install when a dependency's install scripts are not approved
 * (ERR_PNPM_IGNORED_BUILDS). pnpm 12 reads the `allowBuilds` map; pnpm 10 reads
 * `onlyBuiltDependencies`. Only the catalog-listed packages are approved.
 */
export function pnpmWorkspaceYaml(
  approvals: readonly string[],
  packages: readonly string[] = []
): string {
  const quoted = approvals.map((name) => `'${name}'`)
  const workspace =
    packages.length === 0 ? [] : ['packages:', ...packages.map((glob) => `  - '${glob}'`)]
  return [
    ...workspace,
    '# Packages whose install scripts pnpm may run. Keep this list minimal.',
    'allowBuilds:',
    ...quoted.map((name) => `  ${name}: true`),
    'onlyBuiltDependencies:',
    ...quoted.map((name) => `  - ${name}`),
    ''
  ].join('\n')
}
