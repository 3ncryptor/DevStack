import { access } from 'node:fs/promises'
import path from 'node:path'

import { PACKAGE_MANAGERS, packageManagerAdapter } from './index'

/** Lockfile names present in `directory` (bun's older binary lockfile counts as bun.lock). */
export async function lockfilesIn(directory: string): Promise<string[]> {
  const candidates = [
    ...PACKAGE_MANAGERS.map((id) => packageManagerAdapter(id).lockfile),
    'bun.lockb'
  ]
  const present = await Promise.all(
    candidates.map((name) =>
      access(path.join(directory, name)).then(
        () => (name === 'bun.lockb' ? 'bun.lock' : name),
        () => undefined
      )
    )
  )
  return present.filter((name): name is string => name !== undefined)
}
