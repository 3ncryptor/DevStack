import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common'
import type { Response } from 'express'

import { runReadiness, type ReadinessCheck, type ReadinessReport } from '../lib/readiness.js'

export const READINESS_CHECKS = Symbol('READINESS_CHECKS')

/** GET /health is liveness and never touches dependencies; GET /ready runs every check. */
@Controller()
export class HealthController {
  constructor(@Inject(READINESS_CHECKS) private readonly checks: readonly ReadinessCheck[]) {}

  @Get('health')
  health(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.round(process.uptime()) }
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessReport> {
    const { report } = await runReadiness(this.checks)
    response.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
    return report
  }
}
