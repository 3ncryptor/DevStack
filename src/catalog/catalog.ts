export interface CatalogEntry {
  version: string
  /**
   * Packages (this one and/or its transitive dependencies) whose install scripts must run.
   * pnpm >= 11 refuses to install until they are approved.
   */
  allowBuilds?: readonly string[]
}

/** A language's version catalog (buildPlan B9, D-08): the only source of package versions. */
export class VersionCatalog {
  constructor(
    private readonly entries: Readonly<Record<string, CatalogEntry>>,
    /** The file that holds the entries, named in diagnostics. */
    readonly source: string
  ) {}

  has(name: string): boolean {
    return Object.hasOwn(this.entries, name)
  }

  version(name: string): string | undefined {
    return this.has(name) ? this.entries[name]?.version : undefined
  }

  /** Every version range by package, e.g. for `it.versions.turbo` in a Dockerfile. */
  versions(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(this.entries).map(([name, entry]) => [name, entry.version])
    )
  }

  /** Sorted, de-duplicated packages whose install scripts must be approved for `names`. */
  buildApprovals(names: readonly string[]): string[] {
    const approvals = names.flatMap((name) =>
      this.has(name) ? (this.entries[name]?.allowBuilds ?? []) : []
    )
    return [...new Set(approvals)].sort()
  }
}
