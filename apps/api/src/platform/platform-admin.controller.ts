import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  paginationQuerySchema,
  planInputSchema,
  type PlatformSettings,
  platformSettingsSchema,
  platformStoreQuerySchema,
  setStorePlanInputSchema,
  suspendStoreInputSchema,
} from '@repo/contracts';
import { z } from 'zod';
import type { AppRequest, AuthUser, RequestMeta } from '../common/request.js';
import { CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ENV, type Env, requirePlatform2fa } from '../config/env.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { PlatformAdminService } from './platform-admin.service.js';

/**
 * SUPER_ADMIN: full access. SUPPORT: read-only. Everyone else: forbidden. When required
 * (default in production), platform staff must have two-factor authentication enabled.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const role = req.auth?.user.platformRole;
    if (
      (role === 'SUPER_ADMIN' || role === 'SUPPORT') &&
      requirePlatform2fa(this.env) &&
      !req.auth?.user.twoFactorEnabled
    ) {
      throw new ForbiddenException('Enable two-factor authentication to use the platform console.');
    }
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'SUPPORT' && req.method === 'GET') return true;
    throw new ForbiddenException('Platform administrators only.');
  }
}

const userQuerySchema = paginationQuerySchema.extend({ q: z.string().trim().max(100).optional() });

@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService) {}

  @Get('overview')
  overview() {
    return this.platform.overview();
  }

  @Get('stores')
  stores(
    @Query(new ZodPipe(platformStoreQuerySchema)) query: z.output<typeof platformStoreQuerySchema>,
  ) {
    return this.platform.stores(query);
  }

  @Post('stores/:storeId/suspend')
  @HttpCode(204)
  @ApiZodBody(suspendStoreInputSchema)
  suspend(
    @Param('storeId', UuidParam) storeId: string,
    @Body(new ZodPipe(suspendStoreInputSchema)) body: z.output<typeof suspendStoreInputSchema>,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.setStoreStatus(storeId, true, body.reason, user, meta);
  }

  @Post('stores/:storeId/reactivate')
  @HttpCode(204)
  reactivate(
    @Param('storeId', UuidParam) storeId: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.setStoreStatus(storeId, false, null, user, meta);
  }

  @Put('stores/:storeId/plan')
  @HttpCode(204)
  @ApiZodBody(setStorePlanInputSchema)
  setPlan(
    @Param('storeId', UuidParam) storeId: string,
    @Body(new ZodPipe(setStorePlanInputSchema)) body: z.output<typeof setStorePlanInputSchema>,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.setStorePlan(storeId, body, user, meta);
  }

  @Get('plans')
  plans() {
    return this.platform.listPlans();
  }

  @Post('plans')
  @ApiZodBody(planInputSchema)
  createPlan(
    @Body(new ZodPipe(planInputSchema)) body: z.output<typeof planInputSchema>,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.savePlan(null, body, user, meta);
  }

  @Put('plans/:planId')
  @ApiZodBody(planInputSchema)
  updatePlan(
    @Param('planId', UuidParam) planId: string,
    @Body(new ZodPipe(planInputSchema)) body: z.output<typeof planInputSchema>,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.savePlan(planId, body, user, meta);
  }

  @Get('users')
  users(@Query(new ZodPipe(userQuerySchema)) query: z.output<typeof userQuerySchema>) {
    return this.platform.users(query.q, query.page, query.pageSize);
  }

  @Post('users/:userId/disable')
  @HttpCode(204)
  disable(
    @Param('userId', UuidParam) userId: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.setUserDisabled(userId, true, user, meta);
  }

  @Post('users/:userId/enable')
  @HttpCode(204)
  enable(
    @Param('userId', UuidParam) userId: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.setUserDisabled(userId, false, user, meta);
  }

  @Get('settings')
  settings(): Promise<PlatformSettings> {
    return this.platform.getSettings();
  }

  @Put('settings')
  @ApiZodBody(platformSettingsSchema)
  saveSettings(
    @Body(new ZodPipe(platformSettingsSchema)) body: PlatformSettings,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.platform.saveSettings(body, user, meta);
  }

  @Get('audit-logs')
  audit(@Query(new ZodPipe(paginationQuerySchema)) query: z.output<typeof paginationQuerySchema>) {
    return this.platform.auditLog(query.page, query.pageSize);
  }
}
