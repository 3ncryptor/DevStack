import { z } from 'zod'

import { env } from './env'

const readinessSchema = z.object({
  status: z.enum(['ok', 'error']),
  checks: z.record(z.string(), z.enum(['ok', 'error']))
})

export interface Status {
  api: boolean
  checks: Record<string, 'ok' | 'error'>
}

const TIMEOUT_MS = 3000

/** Asks the API's GET /ready, server to server, on every request. */
export async function getStatus(): Promise<Status> {
  try {
    const response = await fetch(`${env.API_URL}/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    const body = readinessSchema.safeParse(await response.json())
    return { api: true, checks: body.success ? body.data.checks : {} }
  } catch {
    // the API is down or unreachable, which is exactly what the page reports
    return { api: false, checks: {} }
  }
}
