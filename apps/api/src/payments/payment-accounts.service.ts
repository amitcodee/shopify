import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConnectAccountInput,
  GatewayInfo,
  GatewayName,
  PaymentAccount as PaymentAccountDto,
  PaymentAccountStatus,
  PaymentsOverview,
  ProviderLink,
} from '@repo/contracts';
import type { PaymentAccount, Prisma, PrismaClient, TenantTx } from '@repo/db';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { ENV, type Env } from '../config/env.js';
import { PLATFORM_DB, TenantDb } from '../database/database.module.js';
import { toDisputeDto } from '../orders/orders.service.js';
import { PlansService } from '../platform/plans.service.js';
import {
  CONNECT_PROVIDERS,
  type ConnectedAccountState,
  type ConnectProvider,
  type ConnectWebhookOutcome,
} from './connect-provider.js';

const NOT_ACCEPTING = 'This store is not accepting payments yet.';
const SUMMARY_DAYS = 30;

/** Where a chargeable store's sales go, resolved inside the checkout transaction. */
export interface PaymentDestination {
  provider: string;
  accountId: string;
  feeBps: number;
}

/**
 * Store payout accounts across gateways (Stripe Connect, Razorpay Route, sandbox). Each store
 * connects one gateway; checkout, refunds and webhooks follow it. Status is kept in sync from
 * Connect webhooks and, for hosted onboarding, re-read when the merchant returns.
 */
@Injectable()
export class PaymentAccountsService {
  private readonly logger = new Logger(PaymentAccountsService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    @Inject(PLATFORM_DB) private readonly platformDb: PrismaClient,
    @Inject(CONNECT_PROVIDERS) private readonly providers: Map<string, ConnectProvider>,
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
    const gateways = this.gateways(data.currency);
    const account = data.account;
    const connected = account && account.status !== 'DISCONNECTED' ? account : null;
    return {
      gateways,
      sandbox: connected
        ? connected.provider === 'mock'
        : gateways.length > 0 && gateways.every((g) => g.sandbox),
      account: account ? this.toDto(account) : null,
      acceptingPayments: connected !== null && this.isChargeable(connected),
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
      payouts: connected ? await this.payouts(connected) : null,
    };
  }

  /**
   * Connects the store to a gateway. Hosted onboarding (Stripe, sandbox) returns the provider's
   * onboarding link (reusing an account in progress); form onboarding (Razorpay) submits the
   * details and returns no link. A store has one account at a time: disconnect to switch.
   */
  async connect(
    store: StoreContext,
    input: ConnectAccountInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ProviderLink> {
    const provider = this.providers.get(input.provider);
    if (!provider) throw new BadRequestException('This payment provider is not available.');
    const details = await this.tenantDb.run(store.id, (tx) =>
      tx.store.findUniqueOrThrow({
        where: { id: store.id },
        select: { name: true, contactEmail: true, currency: true },
      }),
    );
    if (provider.currencies && !provider.currencies.includes(details.currency)) {
      throw new BadRequestException(
        `${provider.label} settles in ${provider.currencies.join(', ')} only; this store sells in ${details.currency}.`,
      );
    }
    const country = input.provider === 'razorpay' ? 'IN' : input.country;
    if (!provider.countries.includes(country)) {
      throw new BadRequestException(`${provider.label} is not available in ${country}.`);
    }

    const existing = await this.find(store.id);
    if (existing && existing.status !== 'DISCONNECTED') {
      if (existing.provider !== input.provider) {
        throw new ConflictException(
          'This store already has a payouts account. Disconnect it before switching providers.',
        );
      }
      if (provider.onboarding === 'hosted') return this.onboardingLink(store.id);
      throw new ConflictException('Payments are already set up with this provider.');
    }

    const created = await provider.createAccount({
      storeId: store.id,
      storeName: details.name,
      email: details.contactEmail,
      country,
      idempotencyKey: `connect-account-${store.id}-${existing?.accountId ?? 'first'}`,
      business: input.provider === 'razorpay' ? input.business : undefined,
    });
    const state = created.state;
    await this.tenantDb.run(store.id, async (tx) => {
      const fields = {
        provider: provider.name,
        accountId: created.accountId,
        status: state ? deriveStatus(state) : ('ONBOARDING' as const),
        chargesEnabled: state?.chargesEnabled ?? false,
        payoutsEnabled: state?.payoutsEnabled ?? false,
        detailsSubmitted: state?.detailsSubmitted ?? false,
        requirementsDue: state?.requirementsDue ?? [],
        disabledReason: state?.disabledReason ?? null,
        country,
        providerData: (created.providerData ?? {}) as Prisma.InputJsonValue,
      };
      const account = await tx.paymentAccount.upsert({
        where: { storeId: store.id },
        create: { storeId: store.id, ...fields },
        update: fields,
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'payments.account_created',
        entityType: 'payment_account',
        entityId: account.id,
        data: { provider: provider.name, accountId: created.accountId, country },
        meta,
      });
    });
    return provider.onboarding === 'hosted' ? this.onboardingLink(store.id) : { url: null };
  }

  /** Stops taking payments through the current account so the store can connect another. */
  async disconnect(store: StoreContext, actor: AuthUser, meta: RequestMeta): Promise<void> {
    await this.tenantDb.run(store.id, async (tx) => {
      const account = await tx.paymentAccount.findUnique({ where: { storeId: store.id } });
      if (!account || account.status === 'DISCONNECTED') {
        throw new NotFoundException('Set up payments first.');
      }
      await tx.paymentAccount.update({
        where: { id: account.id },
        data: { status: 'DISCONNECTED', chargesEnabled: false, payoutsEnabled: false },
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'payments.account_disconnected',
        entityType: 'payment_account',
        entityId: account.id,
        data: { provider: account.provider, accountId: account.accountId },
        meta,
      });
    });
  }

  async onboardingLink(storeId: string): Promise<ProviderLink> {
    const { account, provider } = await this.requireAccount(storeId);
    const base = `${this.env.ADMIN_PUBLIC_URL}/s/${storeId}/settings/payments`;
    const url = await provider.createOnboardingLink(account.accountId, {
      storeId,
      returnUrl: `${base}?onboarding=returned`,
      // Stripe calls this when a link expires or was already used: mint a fresh one.
      refreshUrl: `${base}/onboarding`,
    });
    if (!url) throw new ConflictException(`${provider.label} onboarding happens in this admin.`);
    return { url };
  }

  async dashboardLink(storeId: string): Promise<ProviderLink> {
    const { account, provider } = await this.requireAccount(storeId);
    if (!account.detailsSubmitted) {
      throw new ConflictException('Finish payments onboarding before opening the dashboard.');
    }
    const url = await provider.createDashboardLink(account.accountId, storeId);
    if (!url) throw new NotFoundException(`${provider.label} does not offer a dashboard link.`);
    return { url };
  }

  /** Re-reads the account from the provider (the merchant just returned from onboarding). */
  async refresh(storeId: string): Promise<PaymentsOverview> {
    const { account, provider } = await this.requireAccount(storeId);
    const state = await provider.retrieveAccount(account.accountId, providerData(account));
    if (state) await this.applyState(provider.name, state);
    return this.overview(storeId);
  }

  async acceptingPayments(tx: TenantTx, storeId: string): Promise<boolean> {
    const account = await tx.paymentAccount.findUnique({ where: { storeId } });
    return account !== null && this.isChargeable(account);
  }

  /** Checkout guard: the store's sales destination, or 409 when it cannot take payments. */
  async requireDestination(tx: TenantTx, storeId: string): Promise<PaymentDestination> {
    const account = await tx.paymentAccount.findUnique({ where: { storeId } });
    if (!account || !this.isChargeable(account)) throw new ConflictException(NOT_ACCEPTING);
    const { plan } = await this.plans.subscriptionFor(storeId, tx);
    return {
      provider: account.provider,
      accountId: account.accountId,
      feeBps: plan.transactionFeeBps,
    };
  }

  /** Whether the store's gateway can charge in `currency` (presentment currencies). */
  supportsCurrency(providerName: string, currency: string): boolean {
    const provider = this.providers.get(providerName);
    return Boolean(provider && (!provider.currencies || provider.currencies.includes(currency)));
  }

  requireCurrency(providerName: string, currency: string): Promise<void> {
    if (this.supportsCurrency(providerName, currency)) return Promise.resolve();
    return Promise.reject(
      new ConflictException(
        `This store cannot take payments in ${currency}. Switch currency to continue.`,
      ),
    );
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
    const disconnected = account.status === 'DISCONNECTED';
    await this.platformDb.paymentAccount.update({
      where: { id: account.id },
      data: {
        // A disconnected account stays disconnected; reconnecting creates a new account.
        status: disconnected ? 'DISCONNECTED' : deriveStatus(state),
        chargesEnabled: disconnected ? false : state.chargesEnabled,
        payoutsEnabled: disconnected ? false : state.payoutsEnabled,
        detailsSubmitted: state.detailsSubmitted,
        requirementsDue: state.requirementsDue.slice(0, 50),
        disabledReason: state.disabledReason,
        country: state.country ?? account.country,
      },
    });
  }

  /** Gateways offered to a store: the ones that can settle its currency first. */
  private gateways(currency: string): GatewayInfo[] {
    const all = [...this.providers.values()].map((p) => ({
      provider: p.name as GatewayName,
      label: p.label,
      onboarding: p.onboarding,
      countries: [...p.countries],
      currencies: p.currencies ? [...p.currencies] : null,
      sandbox: p.name === 'mock',
    }));
    const fits = (g: GatewayInfo) => !g.currencies || g.currencies.includes(currency);
    return [...all.filter(fits), ...all.filter((g) => !fits(g))];
  }

  private async payouts(account: PaymentAccount): Promise<PaymentsOverview['payouts']> {
    const provider = this.providers.get(account.provider);
    if (!provider) return null;
    try {
      const payouts = await provider.listPayouts(account.accountId, 10);
      return payouts?.map((p) => ({ ...p, arrivalDate: p.arrivalDate.toISOString() })) ?? null;
    } catch (error) {
      this.logger.warn(`Could not list payouts for ${account.accountId}: ${String(error)}`);
      return null;
    }
  }

  private isChargeable(account: PaymentAccount): boolean {
    return (
      this.providers.has(account.provider) && account.status === 'ACTIVE' && account.chargesEnabled
    );
  }

  private find(storeId: string): Promise<PaymentAccount | null> {
    return this.tenantDb.run(storeId, (tx) => tx.paymentAccount.findUnique({ where: { storeId } }));
  }

  private async requireAccount(
    storeId: string,
  ): Promise<{ account: PaymentAccount; provider: ConnectProvider }> {
    const account = await this.find(storeId);
    const provider = account ? this.providers.get(account.provider) : undefined;
    if (!account || !provider || account.status === 'DISCONNECTED') {
      throw new NotFoundException('Set up payments first.');
    }
    return { account, provider };
  }

  private toDto(account: PaymentAccount): PaymentAccountDto {
    const provider = this.providers.get(account.provider);
    return {
      provider: account.provider as GatewayName,
      label: provider?.label ?? account.provider,
      accountId: account.accountId,
      status: account.status,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      requirementsDue: account.requirementsDue,
      disabledReason: account.disabledReason,
      country: account.country,
      hasDashboard: provider?.hasDashboard ?? false,
      gatewayEnabled: provider !== undefined,
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}

/**
 * ACTIVE once charges are enabled; RESTRICTED when the provider needs something from the
 * merchant (outstanding requirements or a disabled reason); otherwise still ONBOARDING (which
 * includes "submitted, in review").
 */
export function deriveStatus(state: ConnectedAccountState): PaymentAccountStatus {
  if (state.chargesEnabled) return 'ACTIVE';
  if (state.detailsSubmitted && (state.requirementsDue.length > 0 || state.disabledReason)) {
    return 'RESTRICTED';
  }
  return 'ONBOARDING';
}

function providerData(account: PaymentAccount): Record<string, string> {
  const data = account.providerData;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, string>)
    : {};
}
