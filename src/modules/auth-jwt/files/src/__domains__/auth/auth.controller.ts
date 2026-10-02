import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'

import { ApiError, UnauthorizedError } from '../../lib/errors.js'
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe.js'
import {
  clearSessionCookies,
  readCookie,
  REFRESH_COOKIE,
  setSessionCookies
} from './auth.cookies.js'
import { AUTH_SERVICE, AuthGuard, CredentialLimitGuard } from './auth.guard.js'
import { loginSchema, registerSchema } from './auth.schemas.js'
import type { AuthService, LoginInput, RegisterInput, Session } from './auth.service.js'
import { assertTrustedOrigin } from './require-auth.js'

/** POST /auth/register, /auth/login, /auth/refresh, /auth/logout and GET /auth/me (B17.5). */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @UseGuards(CredentialLimitGuard)
  async register(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput
  ) {
    // login CSRF: credentials may only be posted from a trusted origin, like any cookie write
    assertTrustedOrigin(request, this.auth.config)
    return this.started(response, await this.auth.register(body))
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(CredentialLimitGuard)
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput
  ) {
    assertTrustedOrigin(request, this.auth.config)
    return this.started(response, await this.auth.login(body))
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    assertTrustedOrigin(request, this.auth.config)
    const token = readCookie(request, REFRESH_COOKIE)
    if (token === undefined) throw new UnauthorizedError('No session to refresh')
    try {
      return this.started(response, await this.auth.refresh(token))
    } catch (error: unknown) {
      // a dead refresh token is useless to the browser: drop both cookies with the 401; a
      // server error keeps them, so the session survives a database blip
      if (error instanceof ApiError && error.status === 401) {
        clearSessionCookies(response, this.auth.config)
      }
      throw error
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    assertTrustedOrigin(request, this.auth.config)
    await this.auth.logout(readCookie(request, REFRESH_COOKIE))
    clearSessionCookies(response, this.auth.config)
    return null
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() request: Request) {
    // AuthGuard sets request.user
    return { user: await this.auth.currentUser(request.user?.userId ?? '') }
  }

  /**
   * The tokens live only in httpOnly cookies, so a script on the page can never read one (D-66);
   * the body says who is logged in and until when the access token is valid.
   */
  private started(response: Response, session: Session) {
    setSessionCookies(response, this.auth.config, session)
    return {
      user: session.user,
      accessTokenExpiresAt: session.accessToken.expiresAt.toISOString()
    }
  }
}
