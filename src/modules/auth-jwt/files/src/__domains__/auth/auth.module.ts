import { Module, type DynamicModule } from '@nestjs/common'

import { AuthController } from './auth.controller.js'
import { AUTH_SERVICE, AuthGuard, CredentialLimitGuard, RolesGuard } from './auth.guard.js'
import type { AuthService } from './auth.service.js'

/**
 * The auth routes and guards; global, so any feature module can `@UseGuards(AuthGuard)`. The
 * service comes from the entry point (or a test), like every other dependency.
 */
@Module({})
export class AuthModule {
  static register(auth: AuthService): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      controllers: [AuthController],
      providers: [
        { provide: AUTH_SERVICE, useValue: auth },
        AuthGuard,
        RolesGuard,
        CredentialLimitGuard
      ],
      exports: [AUTH_SERVICE, AuthGuard, RolesGuard]
    }
  }
}
