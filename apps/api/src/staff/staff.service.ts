import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthSession,
  CreatedInvitation,
  InvitationPreview,
  StaffList,
  StaffMember,
  acceptInvitationInputSchema,
  inviteStaffInputSchema,
  updateMemberInputSchema,
} from '@repo/contracts';
import { type PrismaClient, setTenant, type StoreInvitation } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from '../auth/password.service.js';
import { hashToken, SessionService } from '../auth/session.service.js';
import type { Permission } from '@repo/contracts';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { APP_DB } from '../database/database.module.js';
import { EMAIL_SENDER, type EmailSender } from '../email/email.js';
import { PlanLimits } from '../platform/plans.service.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OWNER_ONLY: Permission[] = ['staff:manage', 'billing:manage'];

/**
 * Guards against privilege escalation: nobody edits their own access; only the owner assigns the
 * ADMIN role, owner-only permissions, or changes ADMINs; nobody grants what they do not hold.
 */
function assertCanAssign(
  actorStore: StoreContext,
  role: 'ADMIN' | 'STAFF',
  permissions: readonly string[],
  target?: { userId: string; role: string },
  actorUserId?: string,
): void {
  if (target && actorUserId && target.userId === actorUserId) {
    throw new ForbiddenException('You cannot change your own access.');
  }
  if (actorStore.role === 'OWNER') return;
  if (role === 'ADMIN' || target?.role === 'ADMIN') {
    throw new ForbiddenException('Only the store owner can manage admins.');
  }
  for (const permission of permissions) {
    if (
      OWNER_ONLY.includes(permission as Permission) ||
      !actorStore.permissions.includes(permission as Permission)
    ) {
      throw new ForbiddenException(
        `You cannot grant a permission you do not hold (${permission}).`,
      );
    }
  }
}

@Injectable()
export class StaffService {
  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly limits: PlanLimits,
  ) {}

  async list(storeId: string): Promise<StaffList> {
    const [members, invitations] = await Promise.all([
      this.db.storeMember.findMany({
        where: { storeId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.db.storeInvitation.findMany({
        where: { storeId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      members: members.map((m): StaffMember => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        permissions: m.permissions,
        createdAt: m.createdAt.toISOString(),
      })),
      invitations: invitations.map((i) => this.toInvitation(i)),
    };
  }

  async invite(
    actorStore: StoreContext,
    input: z.output<typeof inviteStaffInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<CreatedInvitation> {
    const storeId = actorStore.id;
    assertCanAssign(actorStore, input.role, input.role === 'STAFF' ? input.permissions : []);
    const existingMember = await this.db.storeMember.findFirst({
      where: { storeId, user: { email: input.email } },
    });
    if (existingMember)
      throw new ConflictException('This person is already a member of the store.');

    const token = randomBytes(32).toString('base64url');
    const store = await this.db.store.findUniqueOrThrow({ where: { id: storeId } });
    const invitation = await this.db.$transaction(async (tx) => {
      await this.limits.assertCanAddStaff(tx, storeId);
      await tx.storeInvitation.deleteMany({
        where: { storeId, email: input.email, acceptedAt: null },
      });
      const created = await tx.storeInvitation.create({
        data: {
          storeId,
          email: input.email,
          role: input.role,
          permissions: input.role === 'STAFF' ? input.permissions : [],
          tokenHash: hashToken(token),
          invitedByUserId: actor.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      await setTenant(tx, storeId);
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'staff.invited',
        entityType: 'invitation',
        entityId: created.id,
        data: { email: input.email, role: input.role },
        meta,
      });
      return created;
    });

    const acceptUrl = `${this.env.ADMIN_PUBLIC_URL}/invite/${token}`;
    await this.email.send({
      to: input.email,
      subject: `You're invited to help run ${store.name}`,
      text: `${actor.name} invited you to join ${store.name} as ${input.role.toLowerCase()}.\n\nAccept the invitation: ${acceptUrl}\n\nThis link expires in 7 days.`,
    });
    // The link goes only to the invitee's inbox: accepting it proves control of the address.
    return this.toInvitation(invitation);
  }

  async revokeInvitation(
    storeId: string,
    invitationId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    await this.db.$transaction(async (tx) => {
      const result = await tx.storeInvitation.deleteMany({
        where: { id: invitationId, storeId, acceptedAt: null },
      });
      if (result.count === 0) throw new NotFoundException('Invitation not found.');
      await setTenant(tx, storeId);
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'staff.invitation_revoked',
        entityType: 'invitation',
        entityId: invitationId,
        meta,
      });
    });
  }

  async updateMember(
    actorStore: StoreContext,
    memberId: string,
    input: z.output<typeof updateMemberInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    const storeId = actorStore.id;
    await this.db.$transaction(async (tx) => {
      const member = await tx.storeMember.findFirst({ where: { id: memberId, storeId } });
      if (!member) throw new NotFoundException('Member not found.');
      if (member.role === 'OWNER')
        throw new ForbiddenException('The store owner cannot be changed.');
      assertCanAssign(
        actorStore,
        input.role,
        input.role === 'STAFF' ? input.permissions : [],
        member,
        actor.id,
      );
      await tx.storeMember.update({
        where: { id: memberId },
        data: { role: input.role, permissions: input.role === 'STAFF' ? input.permissions : [] },
      });
      await setTenant(tx, storeId);
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'staff.updated',
        entityType: 'member',
        entityId: memberId,
        data: { role: input.role, permissions: input.permissions },
        meta,
      });
    });
  }

  async removeMember(
    actorStore: StoreContext,
    memberId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    const storeId = actorStore.id;
    await this.db.$transaction(async (tx) => {
      const member = await tx.storeMember.findFirst({ where: { id: memberId, storeId } });
      if (!member) throw new NotFoundException('Member not found.');
      if (member.role === 'OWNER')
        throw new ForbiddenException('The store owner cannot be removed.');
      assertCanAssign(actorStore, 'STAFF', [], member, actor.id);
      await tx.storeMember.delete({ where: { id: memberId } });
      await setTenant(tx, storeId);
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'staff.removed',
        entityType: 'member',
        entityId: memberId,
        data: { userId: member.userId },
        meta,
      });
    });
  }

  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findValidInvitation(token);
    const [store, user] = await Promise.all([
      this.db.store.findUniqueOrThrow({ where: { id: invitation.storeId } }),
      this.db.user.findUnique({ where: { email: invitation.email } }),
    ]);
    return {
      storeName: store.name,
      email: invitation.email,
      role: invitation.role,
      accountExists: Boolean(user),
    };
  }

  /**
   * Accepts an invitation. Existing accounts must be signed in as the invited email; new users
   * provide a name and password and get a session back.
   */
  async accept(
    token: string,
    input: z.output<typeof acceptInvitationInputSchema>,
    signedIn: AuthUser | null,
    meta: RequestMeta,
  ): Promise<{ storeId: string; session: AuthSession | null }> {
    const invitation = await this.findValidInvitation(token);
    let userId: string;
    let session: AuthSession | null = null;

    const existing = await this.db.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      if (!signedIn || signedIn.id !== existing.id) {
        throw new ForbiddenException(`Sign in as ${invitation.email} to accept this invitation.`);
      }
      userId = existing.id;
    } else {
      if (!input.name || !input.password) {
        throw new ConflictException('Choose a name and a password to create your account.');
      }
      const user = await this.db.user.create({
        data: {
          email: invitation.email,
          name: input.name,
          passwordHash: await this.passwords.hash(input.password),
          emailVerifiedAt: new Date(),
        },
      });
      userId = user.id;
      const created = await this.sessions.create(user.id, meta);
      session = {
        token: created.token,
        expiresAt: created.expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          twoFactorEnabled: false,
          emailVerified: true,
        },
      };
    }

    await this.db.$transaction(async (tx) => {
      const claimed = await tx.storeInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw new NotFoundException('Invitation not found or already used.');
      await tx.storeMember.upsert({
        where: { storeId_userId: { storeId: invitation.storeId, userId } },
        update: {},
        create: {
          storeId: invitation.storeId,
          userId,
          role: invitation.role,
          permissions: invitation.permissions,
        },
      });
      await setTenant(tx, invitation.storeId);
      await this.audit.record(tx, {
        storeId: invitation.storeId,
        actorUserId: userId,
        action: 'staff.joined',
        entityType: 'member',
        entityId: userId,
        data: { role: invitation.role },
        meta,
      });
    });
    return { storeId: invitation.storeId, session };
  }

  private async findValidInvitation(token: string): Promise<StoreInvitation> {
    const invitation = await this.db.storeInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
      throw new NotFoundException('This invitation is invalid or has expired.');
    }
    return invitation;
  }

  private toInvitation(i: StoreInvitation) {
    return {
      id: i.id,
      email: i.email,
      role: i.role,
      permissions: i.permissions,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    };
  }
}
