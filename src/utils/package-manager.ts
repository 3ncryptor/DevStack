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
