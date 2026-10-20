import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthSession,
  type CurrentUser as CurrentUserDto,
  type LoginInput,
  type LoginResult,
  loginInputSchema,
  mfaLoginInputSchema,
  totpCodeInputSchema,
  type TwoFactorSetup,
  type SignupInput,
  signupInputSchema,
  verifyEmailInputSchema,
} from '@repo/contracts';
import type { AppRequest, AuthUser, RequestMeta } from '../common/request.js';
import { CurrentUser, ReqMeta } from '../common/request.js';
import type { z } from 'zod';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { Public } from './auth.guard.js';
import { PlatformSettingsService } from '../platform/platform-settings.service.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  @ApiZodBody(signupInputSchema)
  signup(
    @Body(new ZodPipe(signupInputSchema)) body: SignupInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AuthSession> {
    return this.auth.signup(body, meta);
  }

  /** Target of the sign-up email link (via the admin app). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(204)
  @ApiZodBody(verifyEmailInputSchema)
  verifyEmail(
    @Body(new ZodPipe(verifyEmailInputSchema)) body: z.output<typeof verifyEmailInputSchema>,
  ): Promise<void> {
    return this.auth.verifyEmail(body.token);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('verify-email/resend')
  @HttpCode(204)
  resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.resendVerification(user);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiZodBody(loginInputSchema)
  login(
    @Body(new ZodPipe(loginInputSchema)) body: LoginInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LoginResult> {
    return this.auth.login(body, meta);
  }

  /** Second sign-in step for accounts with two-factor authentication. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/mfa')
  @HttpCode(200)
  @ApiZodBody(mfaLoginInputSchema)
  loginMfa(
    @Body(new ZodPipe(mfaLoginInputSchema)) body: z.output<typeof mfaLoginInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AuthSession> {
    return this.auth.completeMfaLogin(body.mfaToken, body.code, meta);
  }

  @ApiBearerAuth()
  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@CurrentUser() user: AuthUser): Promise<TwoFactorSetup> {
    return this.auth.startTwoFactorSetup(user);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/enable')
  @HttpCode(204)
  @ApiZodBody(totpCodeInputSchema)
  enableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Req() req: AppRequest,
    @Body(new ZodPipe(totpCodeInputSchema)) body: z.output<typeof totpCodeInputSchema>,
  ): Promise<void> {
    return this.auth.enableTwoFactor(user, body.code, req.auth?.sessionId ?? '');
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/disable')
  @HttpCode(204)
  @ApiZodBody(totpCodeInputSchema)
  disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Req() req: AppRequest,
    @Body(new ZodPipe(totpCodeInputSchema)) body: z.output<typeof totpCodeInputSchema>,
  ): Promise<void> {
    return this.auth.disableTwoFactor(user, body.code, req.auth?.sessionId ?? '');
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest): Promise<void> {
    if (req.auth) await this.auth.logout(req.auth.token);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): CurrentUserDto {
    return user;
  }

  /** Platform notice and support contact shown in the merchant admin. */
  @ApiBearerAuth()
  @Get('platform-notice')
  async notice(): Promise<{ adminNotice: string; supportEmail: string }> {
    const { adminNotice, supportEmail } = await this.platformSettings.get();
    return { adminNotice, supportEmail };
  }
}
