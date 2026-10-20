import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Permission, permissionsForRole } from '@repo/contracts';
import { isUuid, type PrismaClient } from '@repo/db';
import type { AppRequest } from '../common/request.js';
import { APP_DB } from '../database/database.module.js';

const REQUIRED_PERMISSION = 'tenancy:requiredPermission';
const ALLOW_SUSPENDED = 'tenancy:allowSuspended';

/** Requires the caller's role in the target store to grant `permission`. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

/** Lets a read-only route work while the store is suspended (so the UI can explain why). */
export const AllowSuspendedStore = () => SetMetadata(ALLOW_SUSPENDED, true);

/**
 * Authorizes `/admin/stores/:storeId/*`. The URL store id is only a request: it is honoured
 * only if the signed-in user is a member of that store. Non-members get 404 (not 403) so store
 * ids cannot be probed. Sets `req.store` for downstream handlers.
 */
@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_DB) private readonly db: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const storeId = req.params.storeId;
    const userId = req.auth?.user.id;
    if (!userId || !isUuid(storeId)) throw new NotFoundException('Store not found.');

    const member = await this.db.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      include: { store: { select: { status: true, currency: true } } },
    });
    if (!member) throw new NotFoundException('Store not found.');

    const targets = [context.getHandler(), context.getClass()];
    if (
      member.store.status === 'SUSPENDED' &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_SUSPENDED, targets)
    ) {
      throw new ForbiddenException('This store is suspended. Contact platform support.');
    }

    const permissions = permissionsForRole(member.role, member.permissions);
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );
    if (required && !permissions.includes(required)) {
      throw new ForbiddenException(`Your role does not allow this action (${required}).`);
    }

    req.store = { id: storeId, role: member.role, permissions, currency: member.store.currency };
    return true;
  }
}
