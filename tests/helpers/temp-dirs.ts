import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const created: string[] = []

/** A fresh, empty temp directory that `removeTempDirs` deletes when the test file is done. */
export async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix))
  created.push(dir)
  return dir
}

/** Use as `afterAll(removeTempDirs)`; removes only directories this helper created. */
export async function removeTempDirs(): Promise<void> {
  const dirs = created.splice(0)
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
}
