import path from 'node:path'

import fs from 'fs-extra'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

const LOCKFILE_MAP: Array<{ file: string; manager: PackageManager }> = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lock', manager: 'bun' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' }
]

export async function detectPackageManager(searchDir = process.cwd()): Promise<PackageManager> {
  for (const lockfile of LOCKFILE_MAP) {
    const lockfilePath = path.join(searchDir, lockfile.file)
    if (await fs.pathExists(lockfilePath)) {
      return lockfile.manager
    }
  }

  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('pnpm')) {
    return 'pnpm'
  }

  if (userAgent.startsWith('yarn')) {
    return 'yarn'
  }

  if (userAgent.startsWith('bun')) {
    return 'bun'
  }

  return 'npm'
}

export function getInstallArgs(manager: PackageManager): string[] {
  switch (manager) {
    case 'bun':
      return ['install']
    case 'pnpm':
    case 'yarn':
    case 'npm':
    default:
      return ['install']
  }
}

export function getRunScriptArgs(manager: PackageManager, script: string): string[] {
  switch (manager) {
    case 'yarn':
      return ['run', script]
    case 'pnpm':
    case 'npm':
    case 'bun':
    default:
      return ['run', script]
  }
}

export function getExecArgs(
  manager: PackageManager,
  binary: string,
  args: string[] = []
): string[] {
  switch (manager) {
    case 'pnpm':
      return ['exec', binary, ...args]
    case 'yarn':
      return [binary, ...args]
    case 'bun':
      return ['x', binary, ...args]
    case 'npm':
    default:
      return ['exec', '--', binary, ...args]
  }
}

export function getHookCommand(manager: PackageManager, binary: string): string {
  switch (manager) {
    case 'pnpm':
      return `pnpm exec ${binary}`
    case 'yarn':
      return `yarn ${binary}`
    case 'bun':
      return `bunx ${binary}`
    case 'npm':
    default:
      return `npx --no -- ${binary}`
  }
}

/** Command lines a Dockerfile or README needs for a package manager (buildPlan B7, task 0.10). */
export interface PackageManagerCommands {
  /** Dockerfile line that installs the package manager itself, or '' when the image has it. */
  setup: string
  /** Files the install needs, copied before the source for layer caching. */
  manifests: string
  installFrozen: string
  /** Production dependencies only; scripts are skipped (no dev tools such as husky exist). */
  installProd: string
  exec: string
  run: string
}

export function packageManagerCommands(manager: PackageManager): PackageManagerCommands {
  switch (manager) {
    case 'pnpm':
      return {
        setup: 'RUN npm install --global pnpm@12',
        manifests: 'package.json pnpm-lock.yaml pnpm-workspace.yaml',
        installFrozen: 'pnpm install --frozen-lockfile',
        installProd: 'pnpm install --frozen-lockfile --prod --ignore-scripts',
        exec: 'pnpm exec',
        run: 'pnpm run'
      }
    case 'yarn':
      return {
        setup: '',
        manifests: 'package.json yarn.lock',
        installFrozen: 'yarn install --frozen-lockfile',
        installProd: 'yarn install --frozen-lockfile --production --ignore-scripts',
        exec: 'yarn',
        run: 'yarn run'
      }
    case 'bun':
      return {
        setup: 'RUN npm install --global bun',
        manifests: 'package.json bun.lock',
        installFrozen: 'bun install --frozen-lockfile',
        installProd: 'bun install --frozen-lockfile --production --ignore-scripts',
        exec: 'bunx',
        run: 'bun run'
      }
    case 'npm':
    default:
      return {
        setup: '',
        manifests: 'package.json package-lock.json',
        installFrozen: 'npm ci',
        installProd: 'npm ci --omit=dev --ignore-scripts',
        exec: 'npx --no --',
        run: 'npm run'
      }
  }
}
