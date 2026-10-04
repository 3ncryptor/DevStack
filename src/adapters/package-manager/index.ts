/** Package managers DevStack generates for (buildPlan B7). */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const

export type PackageManagerId = (typeof PACKAGE_MANAGERS)[number]

/** Command lines a Dockerfile needs (task 0.10). */
export interface DockerCommands {
  /** Line that installs the package manager itself, or '' when the base image has it. */
  setup: string
  /** Files the install needs, copied before the source for layer caching. */
  manifests: string
  installFrozen: string
  /** Production dependencies only, without scripts (no dev tools such as husky exist). */
  installProd: string
  /** Runs named packages' install scripts after `installProd`, e.g. a native binary download. */
  rebuild: string
  exec: string
  run: string
}

/** Everything DevStack needs to know about one package manager (buildPlan B7). */
export interface PackageManagerAdapter {
  id: PackageManagerId
  lockfile: string
  /** Arguments after the binary, e.g. `pnpm install`. */
  install(): string[]
  exec(binary: string, args?: readonly string[]): string[]
  run(script: string): string[]
  /** Shell line for a git hook file. */
  hookCommand(binary: string): string
  /**
   * Dockerfile lines for the version that wrote the lockfile: another version may resolve or
   * vet the lockfile differently (e.g. pnpm's minimum release age) and fail the frozen install.
   */
  docker(version: string): DockerCommands
}

const ADAPTERS: Record<PackageManagerId, PackageManagerAdapter> = {
  npm: {
    id: 'npm',
    lockfile: 'package-lock.json',
    install: () => ['install'],
    exec: (binary, args = []) => ['exec', '--', binary, ...args],
    run: (script) => ['run', script],
    hookCommand: (binary) => `npx --no -- ${binary}`,
    docker: () => ({
      setup: '',
      manifests: 'package.json package-lock.json',
      installFrozen: 'npm ci',
      // dev tools that are also optional peers of a runtime package (prisma, typescript) are
      // `devOptional` in the lockfile and are only dropped when optional is omitted as well (D-57)
      installProd: 'npm ci --omit=dev --omit=optional --ignore-scripts',
      exec: 'npx --no --',
      run: 'npm run',
      rebuild: 'npm rebuild'
    })
  },
  pnpm: {
    id: 'pnpm',
    lockfile: 'pnpm-lock.yaml',
    install: () => ['install'],
    exec: (binary, args = []) => ['exec', binary, ...args],
    run: (script) => ['run', script],
    hookCommand: (binary) => `pnpm exec ${binary}`,
    docker: (version) => ({
      setup: `RUN npm install --global pnpm@${version}`,
      manifests: 'package.json pnpm-lock.yaml pnpm-workspace.yaml',
      installFrozen: 'pnpm install --frozen-lockfile',
      installProd: 'pnpm install --frozen-lockfile --prod --ignore-scripts',
      exec: 'pnpm exec',
      run: 'pnpm run',
      rebuild: 'pnpm rebuild'
    })
  },
  yarn: {
    id: 'yarn',
    lockfile: 'yarn.lock',
    install: () => ['install'],
    exec: (binary, args = []) => [binary, ...args],
    run: (script) => ['run', script],
    hookCommand: (binary) => `yarn ${binary}`,
    // yarn 1 ships with the Node.js images
    docker: () => ({
      setup: '',
      manifests: 'package.json yarn.lock',
      installFrozen: 'yarn install --frozen-lockfile',
      installProd: 'yarn install --frozen-lockfile --production --ignore-scripts',
      exec: 'yarn',
      run: 'yarn run',
      // yarn 1 has no rebuild; its node_modules is npm's layout
      rebuild: 'npm rebuild'
    })
  },
  bun: {
    id: 'bun',
    lockfile: 'bun.lock',
    install: () => ['install'],
    exec: (binary, args = []) => ['x', binary, ...args],
    run: (script) => ['run', script],
    hookCommand: (binary) => `bunx ${binary}`,
    docker: (version) => ({
      setup: `RUN npm install --global bun@${version}`,
      manifests: 'package.json bun.lock',
      installFrozen: 'bun install --frozen-lockfile',
      installProd: 'bun install --frozen-lockfile --production --ignore-scripts',
      exec: 'bunx',
      run: 'bun run',
      // bun installs npm's node_modules layout
      rebuild: 'npm rebuild'
    })
  }
}

export function packageManagerAdapter(id: PackageManagerId): PackageManagerAdapter {
  return ADAPTERS[id]
}

export function isPackageManagerId(value: string): value is PackageManagerId {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value)
}

export interface PackageManagerSignals {
  /** `--pm` */
  flag: PackageManagerId | undefined
  /** `packageManager` in a stack config or a preset */
  config: PackageManagerId | undefined
  /** The remembered default (task 5.4): a stated preference beats guessing from the folder. */
  remembered?: PackageManagerId | undefined
  /** `npm_config_user_agent`, set by `npm create`, `pnpm create`, `yarn create`, `bunx` */
  userAgent: string
  /** Lockfile names present in the current directory */
  lockfiles: readonly string[]
}

export interface PackageManagerChoice {
  id: PackageManagerId
  /** Why this one was chosen, for the log. */
  source: string
}

/**
 * Picks the package manager: `--pm` > config > the package manager that invoked the CLI >
 * a lockfile in the current folder > npm. npm's own user agent is not a signal, because `npx`
 * reports npm whatever the user prefers.
 */
export function choosePackageManager(signals: PackageManagerSignals): PackageManagerChoice {
  if (signals.flag !== undefined) return { id: signals.flag, source: '--pm' }
  if (signals.config !== undefined) return { id: signals.config, source: 'config' }
  if (signals.remembered !== undefined) {
    return { id: signals.remembered, source: 'your remembered default' }
  }
  const invokedWith = signals.userAgent.split('/')[0] ?? ''
  if (isPackageManagerId(invokedWith) && invokedWith !== 'npm') {
    return { id: invokedWith, source: `invoked with ${invokedWith}` }
  }
  for (const id of ['pnpm', 'yarn', 'bun', 'npm'] as const) {
    const lockfile = ADAPTERS[id].lockfile
    if (signals.lockfiles.includes(lockfile)) return { id, source: `${lockfile} in this folder` }
  }
  return { id: 'npm', source: 'default' }
}
