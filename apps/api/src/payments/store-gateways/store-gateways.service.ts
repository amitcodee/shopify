import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  findStoreGateway,
  type GatewayMode,
  gatewayModeSchema,
  type CodSettingsInput,
  type SaveStoreGatewayInput,
  type SavedStoreGateway,
  STORE_GATEWAY_IDS,
  type StoreGatewayId,
  type StoreGatewayInfo,
  type StoreGatewaysOverview,
} from '@repo/contracts';
import type { StoreGateway, TenantTx } from '@repo/db';
import { AuditService } from '../../audit/audit.service.js';
import { decryptSecret, encryptSecret } from '../../common/crypto.js';
import type { AuthUser, RequestMeta } from '../../common/request.js';
import { ENV, type Env, decryptionKeys } from '../../config/env.js';
import { TenantDb } from '../../database/database.module.js';
import type { PaymentProvider } from '../payment-provider.js';
import type { FetchLike } from '../razorpay/razorpay-client.js';
import {
  createAdapter,
  GatewayKeysRejectedError,
  ownProviderName,
  parseOwnProviderName,
  type StoreGatewayAdapter,
} from './adapters.js';

export const STORE_GATEWAY_FETCH = Symbol('STORE_GATEWAY_FETCH');

function keyHint(value: string): string {
  const start = value.slice(0, Math.min(9, Math.floor(value.length / 3)));
  return `${start}…${value.slice(-4)}`;
}

/** The test/live mode the key itself declares; null when the merchant chooses it. */
function modeFromKey(
  info: StoreGatewayInfo,
  credentials: Record<string, string>,
): GatewayMode | null {
  if (!info.modeFromKey) return null;
  const value = credentials[info.modeFromKey.field] ?? '';
  if (value.startsWith(info.modeFromKey.test)) return 'test';
  if (info.modeFromKey.live.some((prefix) => value.startsWith(prefix))) return 'live';
  const field = info.fields.find((f) => f.key === info.modeFromKey?.field);
  throw new BadRequestException(
    `${field?.label ?? 'This key'} should start with ${[info.modeFromKey.test, ...info.modeFromKey.live].join(' or ')}.`,
  );
}

/**
 * Gateways merchants connect with their own keys (ADR 0014). Keys are encrypted at rest with
 * APP_ENCRYPTION_KEY, never returned or logged, and proven against the gateway before saving.
 * Each store can save several and activates one; checkout, refunds and webhooks follow it.
 */
@Injectable()
export class StoreGatewaysService {
  private readonly logger = new Logger(StoreGatewaysService.name);
  private readonly apiBase: string;

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORE_GATEWAY_FETCH) private readonly fetchImpl: FetchLike,
  ) {
    this.apiBase = `${env.PUBLIC_API_URL ?? `http://localhost:${env.API_PORT}`}/api/v1`;
  }

  webhookUrl(storeId: string, id: StoreGatewayId): string {
    return `${this.apiBase}/webhooks/store-gateways/${storeId}/${id}`;
  }

  async overview(storeId: string): Promise<StoreGatewaysOverview> {
    const { rows, store } = await this.tenantDb.run(storeId, async (tx) => ({
      rows: await tx.storeGateway.findMany({ where: { storeId }, orderBy: { createdAt: 'asc' } }),
      store: await tx.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { codEnabled: true, codMaxAmount: true, codRequireConfirmation: true },
      }),
    }));
    return {
      cod: {
        enabled: store.codEnabled,
        maxAmount: store.codMaxAmount,
        requireConfirmation: store.codRequireConfirmation,
      },
      connected: rows.map((row) => ({
        id: row.provider as StoreGatewayId,
        mode: gatewayModeSchema.parse(row.mode),
        active: row.active,
        keyHint: row.keyHint,
        verifiedAt: row.verifiedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      webhookUrls: Object.fromEntries(
        STORE_GATEWAY_IDS.map((id) => [id, this.webhookUrl(storeId, id)]),
      ) as Record<StoreGatewayId, string>,
    };
  }

  /** Saves keys after the gateway accepts them. Blank secrets keep the saved values. */
  async save(
    storeId: string,
    id: StoreGatewayId,
    input: SaveStoreGatewayInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<SavedStoreGateway> {
    const info = this.info(id);
    const existing = await this.find(storeId, id);
    const saved = existing ? this.credentialsOf(existing) : {};
    const credentials: Record<string, string> = {};
    for (const field of info.fields) {
      const value = input.credentials[field.key]?.trim() || saved[field.key];
      if (value) credentials[field.key] = value;
      else if (!field.optional) throw new BadRequestException(`Enter the ${field.label}.`);
    }
    const mode = modeFromKey(info, credentials) ?? input.mode ?? 'test';

    try {
      await this.adapter(storeId, id, mode, credentials).verify();
    } catch (error) {
      if (error instanceof GatewayKeysRejectedError) throw new BadRequestException(error.message);
      // Never include the error text: a provider client could echo request details.
      this.logger.warn(`Could not verify ${id} keys for store ${storeId}`);
      throw new BadRequestException(
        `We could not reach ${info.label} to check these keys. Please try again.`,
      );
    }

    const hint = keyHint(credentials[info.hintField] ?? '');
    return this.tenantDb.run(storeId, async (tx) => {
      const fields = {
        mode,
        credentialsEnc: encryptSecret(this.env.APP_ENCRYPTION_KEY, JSON.stringify(credentials)),
        keyHint: hint,
        verifiedAt: new Date(),
      };
      const row = await tx.storeGateway.upsert({
        where: { storeId_provider: { storeId, provider: id } },
        create: { storeId, provider: id, ...fields },
        update: fields,
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: existing ? 'payments.gateway_updated' : 'payments.gateway_added',
        entityType: 'store_gateway',
        entityId: row.id,
        data: { provider: id, mode, keyHint: hint },
        meta,
      });
      if (row.active) return { active: true };
      // Connecting is the whole job: with nothing else taking payments, this one starts now.
      const { currency } = await tx.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { currency: true },
      });
      const fits = !info.currencies || info.currencies.includes(currency);
      const others = await tx.storeGateway.count({ where: { storeId, active: true } });
      if (!fits || others > 0) return { active: false };
      await tx.storeGateway.update({ where: { id: row.id }, data: { active: true } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'payments.gateway_activated',
        entityType: 'store_gateway',
        entityId: row.id,
        data: { provider: id, mode },
        meta,
      });
      return { active: true };
    });
  }

  async saveCod(
    storeId: string,
    input: CodSettingsInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: {
          codEnabled: input.enabled,
          codMaxAmount: input.maxAmount,
          codRequireConfirmation: input.requireConfirmation,
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'payments.cod_updated',
        entityType: 'store',
        entityId: storeId,
        data: {
          enabled: input.enabled,
          maxAmount: input.maxAmount,
          requireConfirmation: input.requireConfirmation,
        },
        meta,
      });
    });
  }

  /** Makes this the gateway shoppers pay with, replacing any other. */
  async activate(
    storeId: string,
    id: StoreGatewayId,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    const info = this.info(id);
    await this.tenantDb.run(storeId, async (tx) => {
      const row = await tx.storeGateway.findUnique({
        where: { storeId_provider: { storeId, provider: id } },
      });
      if (!row) throw new NotFoundException(`Add your ${info.label} keys first.`);
      const { currency } = await tx.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { currency: true },
      });
      if (info.currencies && !info.currencies.includes(currency)) {
        throw new BadRequestException(
          `${info.label} charges in ${info.currencies.join(', ')}; this store sells in ${currency}.`,
        );
      }
      await tx.storeGateway.updateMany({
        where: { storeId, active: true },
        data: { active: false },
      });
      await tx.storeGateway.update({ where: { id: row.id }, data: { active: true } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'payments.gateway_activated',
        entityType: 'store_gateway',
        entityId: row.id,
        data: { provider: id, mode: row.mode },
        meta,
      });
    });
  }

  async deactivate(
    storeId: string,
    id: StoreGatewayId,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const row = await tx.storeGateway.findUnique({
        where: { storeId_provider: { storeId, provider: id } },
      });
      if (!row) throw new NotFoundException('This gateway is not connected.');
      await tx.storeGateway.update({ where: { id: row.id }, data: { active: false } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'payments.gateway_deactivated',
        entityType: 'store_gateway',
        entityId: row.id,
        data: { provider: id },
        meta,
      });
    });
  }

  /** Deletes the keys. Refused once it has taken payments, which may still need refunds. */
  async remove(
    storeId: string,
    id: StoreGatewayId,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const row = await tx.storeGateway.findUnique({
        where: { storeId_provider: { storeId, provider: id } },
      });
      if (!row) throw new NotFoundException('This gateway is not connected.');
      const payments = await tx.payment.count({
        where: {
          storeId,
          provider: { in: [ownProviderName(id, 'live'), ownProviderName(id, 'test')] },
        },
      });
      if (payments > 0) {
        throw new ConflictException(
          'This gateway has taken payments and its keys are needed for refunds. Deactivate it instead.',
        );
      }
      await tx.storeGateway.delete({ where: { id: row.id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'payments.gateway_removed',
        entityType: 'store_gateway',
        entityId: row.id,
        data: { provider: id },
        meta,
      });
    });
  }

  /** The active gateway inside a tenant transaction (checkout guard). */
  async active(
    tx: TenantTx,
    storeId: string,
  ): Promise<{ providerName: string; info: StoreGatewayInfo; mode: GatewayMode } | null> {
    const row = await tx.storeGateway.findFirst({ where: { storeId, active: true } });
    if (!row) return null;
    const info = findStoreGateway(row.provider);
    if (!info) return null;
    const mode = gatewayModeSchema.parse(row.mode);
    return { providerName: ownProviderName(info.id, mode), info, mode };
  }

  /** The adapter behind a Payment.provider name, or null for a non-store gateway name. */
  async forProviderName(storeId: string, name: string): Promise<PaymentProvider | null> {
    const id = parseOwnProviderName(name);
    return id ? this.adapterFor(storeId, id) : null;
  }

  /** The adapter on the store's saved keys, or null when none are saved. */
  async adapterFor(storeId: string, id: StoreGatewayId): Promise<StoreGatewayAdapter | null> {
    const row = await this.find(storeId, id);
    if (!row) return null;
    return this.adapter(storeId, id, gatewayModeSchema.parse(row.mode), this.credentialsOf(row));
  }

  private adapter(
    storeId: string,
    id: StoreGatewayId,
    mode: GatewayMode,
    credentials: Record<string, string>,
  ): StoreGatewayAdapter {
    const base = `${this.apiBase}/store-gateways/${storeId}/${id}`;
    return createAdapter(id, {
      storeId,
      name: ownProviderName(id, mode),
      mode,
      credentials,
      urls: {
        returnUrl: `${base}/return`,
        payUrl: (reference) => `${base}/pay/${reference}`,
      },
      fetch: this.fetchImpl,
    });
  }

  private info(id: StoreGatewayId): StoreGatewayInfo {
    const info = findStoreGateway(id);
    if (!info) throw new NotFoundException('Unknown gateway.');
    return info;
  }

  private find(storeId: string, id: StoreGatewayId): Promise<StoreGateway | null> {
    return this.tenantDb.run(storeId, (tx) =>
      tx.storeGateway.findUnique({ where: { storeId_provider: { storeId, provider: id } } }),
    );
  }

  private credentialsOf(row: StoreGateway): Record<string, string> {
    return JSON.parse(decryptSecret(decryptionKeys(this.env), row.credentialsEnc)) as Record<
      string,
      string
    >;
  }
}
