import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthSession,
  LoginInput,
  LoginResult,
  SignupInput,
  TwoFactorSetup,
} from '@repo/contracts';
import type { PrismaClient, TenantTx, User } from '@repo/db';
import { createHash } from 'node:crypto';
import { decryptSecret, encryptSecret, signToken, verifyToken } from '../common/crypto.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { APP_DB } from '../database/database.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PlatformSettingsService } from '../platform/platform-settings.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

const INVALID_CREDENTIALS = 'Invalid email or password.';
const INVALID_CODE = 'That code is not valid. Check your authenticator app and try again.';
const LOCKED =
  'Too many failed sign-in attempts. We emailed you a link to unlock your account, or try again in 15 minutes.';
const MFA_TTL_MS = 5 * 60 * 1000;
/** Failed password/code attempts before the account is locked for LOCK_MS. */
const MAX_FAILED_LOGINS = 10;
const LOCK_MS = 15 * 60 * 1000;
const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
const INVALID_VERIFY_LINK = 'This verification link is invalid or has expired.';
const INVALID_RESET_LINK = 'This password reset link is invalid or has expired.';
const INVALID_UNLOCK_LINK = 'This unlock link is invalid or has expired.';
const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly outbox: OutboxService,
  ) {}

  async signup(input: SignupInput, meta: RequestMeta): Promise<AuthSession> {
    if (!(await this.platformSettings.get()).signupsEnabled) {
      throw new ForbiddenException('Sign-ups are currently closed.');
    }
    const existing = await this.db.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('An account with this email already exists.');

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await this.sendVerificationEmail(tx, created);
      return created;
    });
    return this.issueSession(user, meta);
  }

  /** Opening the emailed link proves control of the address. Idempotent while the link is valid. */
  async verifyEmail(token: string): Promise<void> {
    const claim = verifyToken<{ uid: string; email: string }>(
      this.env.APP_ENCRYPTION_KEY,
      'verify-email',
      token,
    );
    const user = claim ? await this.db.user.findUnique({ where: { id: claim.uid } }) : null;
    // The email in the link must still be the account's email.
    if (!user || user.email !== claim?.email || user.disabledAt) {
      throw new BadRequestException(INVALID_VERIFY_LINK);
    }
    await this.db.user.updateMany({
      where: { id: user.id, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /** Emails a password reset link. Same response whether or not the account exists. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || user.disabledAt) return;
    const url = `${this.env.ADMIN_PUBLIC_URL}/reset-password/${this.resetToken(user)}`;
    await this.db.$transaction((tx) =>
      this.outbox.enqueueEmail(tx, null, {
        to: user.email,
        subject: 'Reset your password',
        text: `Hi ${user.name},\n\nSomeone asked to reset the password for your account. If it was you, choose a new password:\n${url}\n\nThis link expires in 1 hour and works once. If you did not ask for this, ignore this email: your password stays the same.`,
      }),
    );
  }

  /**
   * Sets a new password from an emailed link. The link is bound to the current password hash, so
   * it works once. Clears any lockout and signs the user out everywhere; it does not sign them
   * in, so two-factor authentication still applies at the next sign-in.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const claim = verifyToken<{ uid: string; ph: string }>(
      this.env.APP_ENCRYPTION_KEY,
      'reset-password',
      token,
    );
    const user = claim ? await this.db.user.findUnique({ where: { id: claim.uid } }) : null;
    if (!user || user.disabledAt || claim?.ph !== passwordFingerprint(user.passwordHash)) {
      throw new BadRequestException(INVALID_RESET_LINK);
    }
    const passwordHash = await this.passwords.hash(password);
    const updated = await this.db.user.updateMany({
      // Conditional on the old hash: two concurrent uses of one link cannot both succeed.
      where: { id: user.id, passwordHash: user.passwordHash },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    if (updated.count === 0) throw new BadRequestException(INVALID_RESET_LINK);
    await this.sessions.revokeAllForUser(user.id);
  }

  /** Ends a lockout early from the link emailed when it started (proves inbox control). */
  async unlockAccount(token: string): Promise<void> {
    const claim = verifyToken<{ uid: string; lu: number }>(
      this.env.APP_ENCRYPTION_KEY,
      'unlock-account',
      token,
    );
    const user = claim ? await this.db.user.findUnique({ where: { id: claim.uid } }) : null;
    // Bound to this lockout: the link stops working once used or once the lock is replaced.
    if (!user || user.disabledAt || user.lockedUntil?.getTime() !== claim?.lu) {
      throw new BadRequestException(INVALID_UNLOCK_LINK);
    }
    await this.db.user.updateMany({
      where: { id: user.id, lockedUntil: user.lockedUntil },
      data: { lockedUntil: null, failedLoginCount: 0 },
    });
  }

  /** Sends a fresh link to a signed-in user who has not verified yet; no-op once verified. */
  async resendVerification(actor: AuthUser): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (user.emailVerifiedAt) return;
    await this.db.$transaction((tx) => this.sendVerificationEmail(tx, user));
  }

  /** Password step. With 2FA enabled it returns a 5-minute signed challenge instead of a session. */
  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.passwords.verifyAgainstDummy(input.password);
    if (user && isLocked(user)) throw new UnauthorizedException(LOCKED);
    if (user && !valid) await this.recordFailure(user.id);
    if (!user || !valid || user.disabledAt) throw new UnauthorizedException(INVALID_CREDENTIALS);
    if (user.totpEnabledAt) {
      return {
        mfaRequired: true,
        mfaToken: signToken(this.env.APP_ENCRYPTION_KEY, 'mfa-login', { uid: user.id }, MFA_TTL_MS),
      };
    }
    return this.issueSession(user, meta);
  }

  /** Second step: the challenge plus a current TOTP code yields a session. */
  async completeMfaLogin(mfaToken: string, code: string, meta: RequestMeta): Promise<AuthSession> {
    const challenge = verifyToken<{ uid: string }>(
      this.env.APP_ENCRYPTION_KEY,
      'mfa-login',
      mfaToken,
    );
    const user = challenge ? await this.db.user.findUnique({ where: { id: challenge.uid } }) : null;
    if (!user || user.disabledAt || !user.totpEnabledAt) {
      throw new UnauthorizedException('Your sign-in expired. Please start again.');
    }
    if (isLocked(user)) throw new UnauthorizedException(LOCKED);
    try {
      await this.consumeCode(user, code);
    } catch (error) {
      await this.recordFailure(user.id);
      throw error;
    }
    return this.issueSession(user, meta);
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }

  /** Starts enrollment: stores a new encrypted secret (inactive until confirmed). */
  async startTwoFactorSetup(actor: AuthUser): Promise<TwoFactorSetup> {
    if (actor.twoFactorEnabled)
      throw new ConflictException('Two-factor authentication is already on.');
    const secret = generateTotpSecret();
    await this.db.user.update({
      where: { id: actor.id },
      data: {
        totpSecretEnc: encryptSecret(this.env.APP_ENCRYPTION_KEY, secret),
        totpLastStep: null,
      },
    });
    return { secret, otpauthUrl: otpauthUrl(secret, actor.email, 'Commerce Platform') };
  }

  /** Turning 2FA on or off signs out every other session (keepSessionId stays signed in). */
  async enableTwoFactor(actor: AuthUser, code: string, keepSessionId: string): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (user.totpEnabledAt) throw new ConflictException('Two-factor authentication is already on.');
    if (!user.totpSecretEnc) throw new BadRequestException('Start two-factor setup first.');
    await this.consumeCode(user, code);
    await this.db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
    await this.sessions.revokeOthers(user.id, keepSessionId);
  }

  async disableTwoFactor(actor: AuthUser, code: string, keepSessionId: string): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!user.totpEnabledAt) throw new BadRequestException('Two-factor authentication is not on.');
    await this.consumeCode(user, code);
    await this.db.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null },
    });
    await this.sessions.revokeOthers(user.id, keepSessionId);
  }

  /**
   * Counts a failed attempt atomically; the 10th failure locks the account for 15 minutes and
   * emails the owner a link to unlock it (or to reset the password if it was not them).
   */
  private async recordFailure(userId: string): Promise<void> {
    const [row] = await this.db.$queryRaw<{ lockedUntil: Date | null; locked: boolean }[]>`
      UPDATE "User" SET
        "lockedUntil" = CASE WHEN "failedLoginCount" + 1 >= ${MAX_FAILED_LOGINS}::int
                             THEN now() + make_interval(secs => ${LOCK_MS / 1000}::double precision)
                             ELSE "lockedUntil" END,
        "failedLoginCount" = CASE WHEN "failedLoginCount" + 1 >= ${MAX_FAILED_LOGINS}::int
                                  THEN 0 ELSE "failedLoginCount" + 1 END
      WHERE id = ${userId}::uuid
      RETURNING "lockedUntil", ("failedLoginCount" = 0 AND "lockedUntil" > now()) AS locked`;
    if (!row?.locked || !row.lockedUntil) return;
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const unlock = signToken(
      this.env.APP_ENCRYPTION_KEY,
      'unlock-account',
      { uid: user.id, lu: row.lockedUntil.getTime() },
      LOCK_MS,
    );
    const admin = this.env.ADMIN_PUBLIC_URL;
    await this.db.$transaction((tx) =>
      this.outbox.enqueueEmail(tx, null, {
        to: user.email,
        subject: 'Your account was locked',
        text: `Hi ${user.name},\n\nWe locked your account for 15 minutes after ${MAX_FAILED_LOGINS} failed sign-in attempts.\n\nIf this was you, unlock it now:\n${admin}/unlock/${unlock}\n\nIf it was not you, someone may be trying to guess your password. Choose a new one:\n${admin}/reset-password/${this.resetToken(user)}`,
      }),
    );
  }

  private resetToken(user: User): string {
    return signToken(
      this.env.APP_ENCRYPTION_KEY,
      'reset-password',
      { uid: user.id, ph: passwordFingerprint(user.passwordHash) },
      RESET_TTL_MS,
    );
  }

  /** Verifies a TOTP code and records its time step so it cannot be replayed. */
  private async consumeCode(user: User, code: string): Promise<void> {
    if (!user.totpSecretEnc) throw new UnauthorizedException(INVALID_CODE);
    const secret = decryptSecret(this.env.APP_ENCRYPTION_KEY, user.totpSecretEnc);
    const step = verifyTotp(secret, code);
    if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) {
      throw new UnauthorizedException(INVALID_CODE);
    }
    // Conditional update closes the race between two concurrent uses of the same code.
    const claimed = await this.db.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    if (claimed.count === 0) throw new UnauthorizedException(INVALID_CODE);
  }

  /** Enqueued in the caller's transaction: the email exists iff the account does. */
  private async sendVerificationEmail(tx: TenantTx, user: User): Promise<void> {
    const token = signToken(
      this.env.APP_ENCRYPTION_KEY,
      'verify-email',
      { uid: user.id, email: user.email },
      VERIFY_EMAIL_TTL_MS,
    );
    const url = `${this.env.ADMIN_PUBLIC_URL}/verify-email/${token}`;
    await this.outbox.enqueueEmail(tx, null, {
      to: user.email,
      subject: 'Confirm your email address',
      text: `Hi ${user.name},

Confirm your email address to finish setting up your account:
${url}

This link expires in 24 hours. If you did not sign up, ignore this email.`,
    });
  }

  private async issueSession(user: User, meta: RequestMeta): Promise<AuthSession> {
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
    const { token, expiresAt } = await this.sessions.create(user.id, meta);
    return {
      token,
      expiresAt: expiresAt.toISOString(),
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
}

function isLocked(user: User): boolean {
  return user.lockedUntil !== null && user.lockedUntil > new Date();
}

/** Short digest of the password hash: changes whenever the password does (single-use links). */
function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 22);
}
