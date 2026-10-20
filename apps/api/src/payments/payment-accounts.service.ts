import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  PaymentAccount as PaymentAccountDto,
  PaymentAccountStatus,
  PaymentsOverview,
  ProviderLink,
} from '@repo/contracts';
import type { PaymentAccount, PrismaClient, TenantTx } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { toDisputeDto } from '../orders/orders.service.js';
import { PlansService } from '../platform/plans.service.js';
import {
  ACTIVE_CONNECT_PROVIDER,
  type ConnectedAccountState,
  type ConnectProvider,
  type ConnectWebhookOutcome,
} from './connect-provider.js';

const NOT_ACCEPTING = 'This store is not accepting payments yet.';
const SUMMARY_DAYS = 30;

/** Where a chargeable store's sales go, resolved inside the checkout transaction. */
export interface PaymentDestination {
  accountId: string;
  feeBps: number;
}

/**
 * Store payout accounts (Stripe Connect). Merchants onboard on the provider's hosted pages;
 * the account's status is kept in sync from Connect webhooks and on return from onboarding.
 */
@Injectable()
export class PaymentAccountsService {
  private readonly logger = new Logger(PaymentAccountsService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
    @Inject(ACTIVE_CONNECT_PROVIDER) private readonly provider: ConnectProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  async overview(storeId: string): Promise<PaymentsOverview> {
    const since = new Date(Date.now() - SUMMARY_DAYS * 24 * 60 * 60 * 1000);
    const data = await this.tenantDb.run(storeId, async (tx) => {
      const [account, subscription, store] = await Promise.all([
        tx.paymentAccount.findUnique({ where: { storeId } }),
        this.plans.subscriptionFor(storeId, tx),
        tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { currency: true } }),
      ]);
      const [paid, refunds, lost, openDisputes, disputes] = await Promise.all([
        tx.payment.aggregate({
          where: {
            storeId,
            status: 'SUCCEEDED',
            currency: store.currency,
            order: { paidAt: { gte: since } },
          },
          _sum: { amount: true, applicationFee: true },
          _count: true,
        }),
        tx.refund.aggregate({
          where: {
            storeId,
            status: { in: ['SUCCEEDED', 'PENDING'] },
            createdAt: { gte: since },
            payment: { currency: store.currency },
          },
          _sum: { amount: true },
        }),
        tx.dispute.aggregate({
          where: { storeId, status: 'LOST', currency: store.currency, updatedAt: { gte: since } },
          _sum: { amount: true },
        }),
        tx.dispute.count({
          where: { storeId, status: { in: ['NEEDS_RESPONSE', 'UNDER_REVIEW'] } },
        }),
        tx.dispute.findMany({
          where: { storeId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { order: { select: { number: true } } },
        }),
      ]);
      return {
        account,
        subscription,
        currency: store.currency,
        paid,
        refunds,
        lost,
        openDisputes,
        disputes,
      };
    });

    const gross = data.paid._sum.amount ?? 0;
    const platformFees = data.paid._sum.applicationFee ?? 0;
    const refunded = data.refunds._sum.amount ?? 0;
    const chargebacks = data.lost._sum.amount ?? 0;
    const account =
      data.account && data.account.provider === this.provider.name ? data.account : null;
    return {
      provider: this.provider.name,
      sandbox: this.provider.name === 'mock',
      account: account ? toDto(account) : null,
      acceptingPayments: account !== null && isChargeable(account),
      transactionFeeBps: data.subscription.plan.transactionFeeBps,
      summary: {
        currency: data.currency,
        days: SUMMARY_DAYS,
        paidOrders: data.paid._count,
        gross,
        platformFees,
        refunds: refunded,
        chargebacks,
        net: gross - platformFees - refunded - chargebacks,
      },
      openDisputes: data.openDisputes,
      disputes: data.disputes.map((d) => toDisputeDto(d, d.order.number)),
      payouts: account ? await this.payouts(account.accountId) : null,
    };
  }

  /**
   * Creates the store's connected account (or reuses it) and returns the hosted onboarding link.
   * A disconnected account is replaced by a new one.
   */
  async connect(
    store: StoreContext,
    country: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ProviderLink> {
    const existing = await this.find(store.id);
    if (
      existing &&
      existing.provider === this.provider.name &&
      existing.status !== 'DISCONNECTED'
    ) {
      return this.onboardingLink(store.id);
    }
    const details = await this.tenantDb.run(store.id, (tx) =>
      tx.store.findUniqueOrThrow({
        where: { id: store.id },
        select: { name: true, contactEmail: true },
      }),
    );
    const { accountId } = await this.provider.createAccount({
      storeId: store.id,
      storeName: details.name,
      email: details.contactEmail,
      country,
      idempotencyKey: `connect-account-${store.id}-${existing?.accountId ?? 'first'}`,
    });
    await this.tenantDb.run(store.id, async (tx) => {
      const reset = {
        provider: this.provider.name,
        accountId,
        status: 'ONBOARDING' as const,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirementsDue: [],
        disabledReason: null,
        country,
      };
      const account = await tx.paymentAccount.upsert({
        where: { storeId: store.id },
        create: { storeId: store.id, ...reset },
        update: reset,
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'payments.account_created',
        entityType: 'payment_account',
        entityId: account.id,
        data: { provider: this.provider.name, accountId, country },
        meta,
      });
    });
    return this.onboardingLink(store.id);
  }

  async onboardingLink(storeId: string): Promise<ProviderLink> {
    const account = await this.requireAccount(storeId);
    const base = `${this.env.ADMIN_PUBLIC_URL}/s/${storeId}/settings/payments`;
    const url = await this.provider.createOnboardingLink(account.accountId, {
      storeId,
      returnUrl: `${base}?onboarding=returned`,
      // Stripe calls this when a link expires or was already used: mint a fresh one.
      refreshUrl: `${base}/onboarding`,
    });
    return { url };
  }

  async dashboardLink(storeId: string): Promise<ProviderLink> {
    const account = await this.requireAccount(storeId);
    if (!account.detailsSubmitted) {
      throw new ConflictException('Finish payments onboarding before opening the dashboard.');
    }
    return { url: await this.provider.createDashboardLink(account.accountId, storeId) };
  }

  /** Re-reads the account from the provider (the merchant just returned from onboarding). */
  async refresh(storeId: string): Promise<PaymentsOverview> {
    const account = await this.requireAccount(storeId);
    const state = await this.provider.retrieveAccount(account.accountId);
    if (state) await this.applyState(this.provider.name, state);
    return this.overview(storeId);
  }

  async acceptingPayments(tx: TenantTx, storeId: string): Promise<boolean> {
    const account = await tx.paymentAccount.findUnique({ where: { storeId } });
    return account !== null && account.provider === this.provider.name && isChargeable(account);
  }

  /** Checkout guard: the store's sales destination, or 409 when it cannot take payments. */
  async requireDestination(tx: TenantTx, storeId: string): Promise<PaymentDestination> {
    const account = await tx.paymentAccount.findUnique({ where: { storeId } });
    if (!account || account.provider !== this.provider.name || !isChargeable(account)) {
      throw new ConflictException(NOT_ACCEPTING);
    }
    const { plan } = await this.plans.subscriptionFor(storeId, tx);
    return { accountId: account.accountId, feeBps: plan.transactionFeeBps };
  }

  /** Applies a verified Connect webhook. Unknown accounts are ignored (logged). */
  async applyWebhook(providerName: string, outcome: ConnectWebhookOutcome): Promise<void> {
    if (outcome.kind === 'account_updated') {
      await this.applyState(providerName, outcome.account);
    } else if (outcome.kind === 'account_deauthorized') {
      const updated = await this.platformDb.paymentAccount.updateMany({
        where: { provider: providerName, accountId: outcome.accountId },
        data: { status: 'DISCONNECTED', chargesEnabled: false, payoutsEnabled: false },
      });
      if (updated.count === 0)
        this.logger.warn(`Deauthorized unknown account ${outcome.accountId}`);
    }
  }

  private async applyState(providerName: string, state: ConnectedAccountState): Promise<void> {
    const account = await this.platformDb.paymentAccount.findUnique({
      where: { provider_accountId: { provider: providerName, accountId: state.accountId } },
    });
    if (!account) {
      this.logger.warn(`Update for unknown connected account ${state.accountId}`);
      return;
    }
    await this.platformDb.paymentAccount.update({
      where: { id: account.id },
      data: {
        // A disconnected account stays disconnected; reconnecting creates a new account.
        status: account.status === 'DISCONNECTED' ? 'DISCONNECTED' : deriveStatus(state),
        chargesEnabled: account.status === 'DISCONNECTED' ? false : state.chargesEnabled,
        payoutsEnabled: account.status === 'DISCONNECTED' ? false : state.payoutsEnabled,
        detailsSubmitted: state.detailsSubmitted,
        requirementsDue: state.requirementsDue.slice(0, 50),
        disabledReason: state.disabledReason,
        country: state.country ?? account.country,
      },
    });
  }

  private async payouts(accountId: string): Promise<PaymentsOverview['payouts']> {
    try {
      const payouts = await this.provider.listPayouts(accountId, 10);
      return payouts?.map((p) => ({ ...p, arrivalDate: p.arrivalDate.toISOString() })) ?? null;
    } catch (error) {
      this.logger.warn(`Could not list payouts for ${accountId}: ${String(error)}`);
      return null;
    }
  }

  private find(storeId: string): Promise<PaymentAccount | null> {
    return this.tenantDb.run(storeId, (tx) => tx.paymentAccount.findUnique({ where: { storeId } }));
  }

  private async requireAccount(storeId: string): Promise<PaymentAccount> {
    const account = await this.find(storeId);
    if (!account || account.provider !== this.provider.name || account.status === 'DISCONNECTED') {
      throw new NotFoundException('Set up payments first.');
    }
    return account;
  }
}

export function deriveStatus(state: ConnectedAccountState): PaymentAccountStatus {
  if (state.chargesEnabled) return 'ACTIVE';
  if (state.detailsSubmitted) return 'RESTRICTED';
  return 'ONBOARDING';
}

function isChargeable(account: PaymentAccount): boolean {
  return account.status === 'ACTIVE' && account.chargesEnabled;
}

function toDto(account: PaymentAccount): PaymentAccountDto {
  return {
    provider: account.provider,
    accountId: account.accountId,
    status: account.status,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    detailsSubmitted: account.detailsSubmitted,
    requirementsDue: account.requirementsDue,
    disabledReason: account.disabledReason,
    country: account.country,
    updatedAt: account.updatedAt.toISOString(),
  };
}
