import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { loadModules } from '../src/core/module-loader'
import { buildGenerationPlan } from '../src/core/planner/index'
import { removeTempDirs, tempDir } from './helpers/temp-dirs'

afterAll(removeTempDirs)

const ALGORITHMS = ['fixed-window', 'sliding-window', 'token-bucket', 'leaky-bucket'] as const
const RUNS = 500
const STEPS = 30

interface Decision {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}
interface Limiter {
  consume(key: string, now: number): Decision
}
type CreateLimiter = (limit: number, windowMs: number) => Limiter

/** The generated src/lib/rate-limiter.ts for one algorithm, written out and imported. */
async function generatedLimiter(algorithm: string): Promise<CreateLimiter> {
  const plan = await buildGenerationPlan({
    projectName: 'limiter',
    projectDir: '/virtual/limiter',
    selectedModuleNames: ['framework-express', 'security-rate-limit'],
    moduleOptions: { 'security-rate-limit': { algorithm } },
    registry: loadModules(),
    packageManager: 'pnpm',
    options: { skipInstall: true, skipGit: true }
  })
  const source = plan.files.find((file) => file.path === 'src/lib/rate-limiter.ts')?.content ?? ''
  const file = path.join(await tempDir('limiter-'), `${algorithm}.ts`)
  await writeFile(file, source)
  return ((await import(file)) as { createLimiter: CreateLimiter }).createLimiter
}

/** mulberry32, so a failure replays the same requests. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Random traffic; every refusal must name a wait after which the next request is allowed. */
function brokenPromises(createLimiter: CreateLimiter): string[] {
  const random = seededRandom(42)
  const problems: string[] = []
  for (let run = 0; run < RUNS; run += 1) {
    const limit = 1 + Math.floor(random() * 5)
    const windowMs = 100 + Math.floor(random() * 2000)
    const limiter = createLimiter(limit, windowMs)
    let now = 1_000_000
    for (let step = 0; step < STEPS; step += 1) {
      now += Math.floor(random() * windowMs * 0.6)
      const decision = limiter.consume('client', now)
      if (decision.remaining < 0) problems.push(`remaining ${decision.remaining}`)
      if (decision.allowed) continue
      now += decision.retryAfterMs
      if (decision.retryAfterMs <= 0 || !limiter.consume('client', now).allowed) {
        problems.push(`limit ${limit}, window ${windowMs}: retry after ${decision.retryAfterMs}`)
        break
      }
    }
  }
  return problems
}

describe('generated rate limiter (D-64)', () => {
  it.each(ALGORITHMS)(
    '%s: a client that waits retryAfterMs is allowed again',
    async (algorithm) => {
      const createLimiter = await generatedLimiter(algorithm)

      expect(brokenPromises(createLimiter)).toEqual([])
    }
  )
})
