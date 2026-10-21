import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@repo/db';
import { ENV, type Env } from '../config/env.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { APP_DB } from '../database/database.module.js';

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Creates a session; only the SHA-256 of the 256-bit random token is persisted. */
  async create(userId: string, meta: RequestMeta): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.db.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    return { token, expiresAt };
  }

  async validate(token: string): Promise<{ sessionId: string; user: AuthUser } | null> {
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || session.user.disabledAt) return null;

    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    }
    const { user } = session;
    return {
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
        twoFactorEnabled: user.totpEnabledAt !== null,
        emailVerified: user.emailVerifiedAt !== null,
      },
    };
  }

  /**
   * Admin API access token: valid while not revoked and its creator is still enabled. Store
   * scoping and permission capping happen in StoreAccessGuard.
   */
  async validateApiToken(
    token: string,
  ): Promise<{ tokenId: string; storeId: string; permissions: string[]; user: AuthUser } | null> {
    const row = await this.db.apiToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { createdBy: true },
    });
    if (!row || row.revokedAt || row.createdBy.disabledAt) return null;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.db.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    }
    const user = row.createdBy;
    return {
      tokenId: row.id,
      storeId: row.storeId,
      permissions: row.permissions,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
        twoFactorEnabled: user.totpEnabledAt !== null,
        emailVerified: user.emailVerifiedAt !== null,
      },
    };
  }

  async revoke(token: string): Promise<void> {
    await this.db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.session.deleteMany({ where: { userId } });
  }

  /** Signs the user out everywhere except the session making the request. */
  async revokeOthers(userId: string, keepSessionId: string): Promise<void> {
    await this.db.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  }
}
