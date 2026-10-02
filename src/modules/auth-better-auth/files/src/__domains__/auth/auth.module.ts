import { Module, type DynamicModule } from '@nestjs/common'

import type { Auth } from './auth.js'
import { AUTH, AuthGuard, RolesGuard } from './auth.guard.js'
import { MeController } from './me.controller.js'

/**
 * GET /me and the guards; global, so any feature module can `@UseGuards(AuthGuard)`. The Better
 * Auth instance comes from the entry point (or a test), like every other dependency.
 */
@Module({})
export class AuthModule {
  static register(auth: Auth): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      controllers: [MeController],
      providers: [{ provide: AUTH, useValue: auth }, AuthGuard, RolesGuard],
      exports: [AUTH, AuthGuard, RolesGuard]
    }
  }
}
