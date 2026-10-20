import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CustomerAccount,
  CustomerRegisterResult,
  CustomerSession,
  PublicOrder,
  customerRegisterInputSchema,
} from '@repo/contracts';
import type { Customer, TenantTx } from '@repo/db';
import type { z } from 'zod';
import { PasswordService } from '../auth/password.service.js';
import { hashToken } from '../auth/session.service.js';
import { toPublicOrder } from '../checkout/checkout.service.js';
import { TenantDb } from '../database/database.module.js';
import { StoreUrls } from '../orders/store-urls.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { customerLinkEmail } from '../outbox/templates.js';
import type { ShopContext } from '../storefront/store-resolver.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const INVALID = 'Invalid email or password.';

/** Per-store customer accounts (separate identity realm from staff users). */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly passwords: PasswordService,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
  ) {}

  async register(
    shop: ShopContext,
    host: string,
    input: z.output<typeof customerRegisterInputSchema>,
  ): Promise<CustomerRegisterResult> {
    const passwordHash = await this.passwords.hash(input.password);
    return this.tenantDb.run(shop.id, async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { storeId_email: { storeId: shop.id, email: input.email } },
      });
      if (existing?.passwordHash) {
        throw new ConflictException('An account with this email already exists. Sign in instead.');
      }
      if (existing) {
        // Guest checkout record: prove email ownership before attaching a password and orders.
        await this.sendLink(tx, shop, host, existing, 'ACTIVATE');
        return { status: 'activation_sent' as const };
      }
      const customer = await tx.customer.create({
        data: {
          storeId: shop.id,
          email: input.email,
          name: input.name,
          passwordHash,
          acceptsMarketing: input.acceptsMarketing,
        },
      });
      return {
        status: 'created' as const,
        session: await this.createSession(tx, shop.id, customer),
      };
    });
  }

  async login(shop: ShopContext, email: string, password: string): Promise<CustomerSession> {
    const customer = await this.tenantDb.run(shop.id, (tx) =>
      tx.customer.findUnique({ where: { storeId_email: { storeId: shop.id, email } } }),
    );
    const ok = customer?.passwordHash
      ? await this.passwords.verify(customer.passwordHash, password)
      : await this.passwords.verifyAgainstDummy(password);
    if (!customer || !ok || customer.disabledAt) throw new UnauthorizedException(INVALID);
    return this.tenantDb.run(shop.id, (tx) => this.createSession(tx, shop.id, customer));
  }

  async logout(shop: ShopContext, token: string | null): Promise<void> {
    if (!token) return;
    await this.tenantDb.run(shop.id, (tx) =>
      tx.customerSession.deleteMany({ where: { storeId: shop.id, tokenHash: hashToken(token) } }),
    );
  }

  /** Resolves the signed-in customer, or null. */
  async current(shop: ShopContext, token: string | null): Promise<Customer | null> {
    if (!token) return null;
    return this.tenantDb.run(shop.id, async (tx) => {
      const session = await tx.customerSession.findFirst({
        where: { storeId: shop.id, tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
        include: { customer: true },
      });
      return session && !session.customer.disabledAt ? session.customer : null;
    });
  }

  async requireCurrent(shop: ShopContext, token: string | null): Promise<Customer> {
    const customer = await this.current(shop, token);
    if (!customer) throw new UnauthorizedException('Sign in to continue.');
    return customer;
  }

  async requestPasswordReset(shop: ShopContext, host: string, email: string): Promise<void> {
    await this.tenantDb.run(shop.id, async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { storeId_email: { storeId: shop.id, email } },
      });
      // Same response whether or not the account exists (no enumeration).
      if (customer?.passwordHash && !customer.disabledAt) {
        await this.sendLink(tx, shop, host, customer, 'RESET_PASSWORD');
      }
    });
  }

  /** Completes activation or password reset with a single-use emailed token. */
  async completeLink(
    shop: ShopContext,
    purpose: 'ACTIVATE' | 'RESET_PASSWORD',
    token: string,
    password: string,
  ): Promise<CustomerSession> {
    const passwordHash = await this.passwords.hash(password);
    return this.tenantDb.run(shop.id, async (tx) => {
      const record = await tx.customerToken.findFirst({
        where: { storeId: shop.id, tokenHash: hashToken(token), purpose },
        include: { customer: true },
      });
      if (!record || record.usedAt || record.expiresAt <= new Date()) {
        throw new NotFoundException('This link is invalid or has expired.');
      }
      // Conditional claim: two concurrent uses of one link cannot both succeed.
      const claimed = await tx.customerToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new NotFoundException('This link is invalid or has expired.');
      await tx.customerSession.deleteMany({
        where: { customerId: record.customerId, storeId: shop.id },
      });
      const customer = await tx.customer.update({
        where: { id: record.customerId },
        data: { passwordHash },
      });
      return this.createSession(tx, shop.id, customer);
    });
  }

  async account(shop: ShopContext, token: string | null): Promise<CustomerAccount> {
    const customer = await this.requireCurrent(shop, token);
    const orders = await this.tenantDb.run(shop.id, (tx) =>
      tx.order.findMany({
        where: { storeId: shop.id, customerId: customer.id, status: { not: 'PENDING_PAYMENT' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      orders: orders.map((o) => ({
        number: o.number,
        status: o.status,
        financialStatus: o.financialStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        total: o.total,
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  async accountOrder(
    shop: ShopContext,
    token: string | null,
    number: number,
  ): Promise<PublicOrder> {
    const customer = await this.requireCurrent(shop, token);
    const order = await this.tenantDb.run(shop.id, (tx) =>
      tx.order.findFirst({
        where: { storeId: shop.id, customerId: customer.id, number },
        include: { lines: true, fulfillments: true },
      }),
    );
    if (!order) throw new NotFoundException('Order not found.');
    return toPublicOrder(shop.name, order);
  }

  private async createSession(
    tx: TenantTx,
    storeId: string,
    customer: Customer,
  ): Promise<CustomerSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await tx.customerSession.create({
      data: { storeId, customerId: customer.id, tokenHash: hashToken(token), expiresAt },
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      customer: { id: customer.id, email: customer.email, name: customer.name },
    };
  }

  private async sendLink(
    tx: TenantTx,
    shop: ShopContext,
    host: string,
    customer: Customer,
    purpose: 'ACTIVATE' | 'RESET_PASSWORD',
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await tx.customerToken.updateMany({
      where: { customerId: customer.id, storeId: shop.id, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.customerToken.create({
      data: {
        storeId: shop.id,
        customerId: customer.id,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
      },
    });
    const path = purpose === 'ACTIVATE' ? 'activate' : 'reset';
    const url = `${this.urls.originForHost(host)}/account/${path}/${token}`;
    await this.outbox.enqueueEmail(
      tx,
      shop.id,
      customerLinkEmail(customer.email, { storeName: shop.name, purpose, url }),
    );
  }
}
