import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  acceptInvitationInputSchema,
  type AuthSession,
  type CreatedInvitation,
  type InvitationPreview,
  inviteStaffInputSchema,
  type StaffList,
  updateMemberInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import { bearerToken, Public } from '../auth/auth.guard.js';
import { SessionService } from '../auth/session.service.js';
import type { AppRequest, AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { StaffService } from './staff.service.js';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermission('settings:read')
  list(@CurrentStore() store: StoreContext): Promise<StaffList> {
    return this.staff.list(store.id);
  }

  @Post('invitations')
  @RequirePermission('staff:manage')
  @ApiZodBody(inviteStaffInputSchema)
  invite(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(inviteStaffInputSchema)) body: z.output<typeof inviteStaffInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<CreatedInvitation> {
    return this.staff.invite(store, body, user, meta);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(204)
  @RequirePermission('staff:manage')
  revoke(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('invitationId', UuidParam) invitationId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.staff.revokeInvitation(store.id, invitationId, user, meta);
  }

  @Patch('members/:memberId')
  @HttpCode(204)
  @RequirePermission('staff:manage')
  @ApiZodBody(updateMemberInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('memberId', UuidParam) memberId: string,
    @Body(new ZodPipe(updateMemberInputSchema)) body: z.output<typeof updateMemberInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.staff.updateMember(store, memberId, body, user, meta);
  }

  @Delete('members/:memberId')
  @HttpCode(204)
  @RequirePermission('staff:manage')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('memberId', UuidParam) memberId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.staff.removeMember(store, memberId, user, meta);
  }
}

/** Public endpoints used by the invite link (the token is the credential). */
@ApiTags('staff')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly staff: StaffService,
    private readonly sessions: SessionService,
  ) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitationPreview> {
    return this.staff.preview(token);
  }

  @Post(':token/accept')
  @ApiZodBody(acceptInvitationInputSchema)
  async accept(
    @Param('token') token: string,
    @Body(new ZodPipe(acceptInvitationInputSchema))
    body: z.output<typeof acceptInvitationInputSchema>,
    @Req() req: AppRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ storeId: string; session: AuthSession | null }> {
    // Optional sign-in: existing accounts accept while signed in as the invited email.
    const bearer = bearerToken(req.headers.authorization);
    const session = bearer ? await this.sessions.validate(bearer) : null;
    return this.staff.accept(token, body, session?.user ?? null, meta);
  }
}
