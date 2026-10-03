import { Module, type DynamicModule } from '@nestjs/common'

import type { ReadinessCheck } from '../lib/readiness.js'
import { HealthController, READINESS_CHECKS } from './health.controller.js'

@Module({})
export class HealthModule {
  static register(checks: readonly ReadinessCheck[]): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [{ provide: READINESS_CHECKS, useValue: checks }]
    }
  }
}
