import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type GiftCardStatus, normalizeGiftCardCode } from '@repo/contracts';
import type { GiftCard, GiftCardTransactionKind, TenantTx } from '@repo/db';
import { ENV, type Env } from '../config/env.js';

export function giftCardStatus(card: GiftCard, now = new Date()): GiftCardStatus {
  if (card.disabledAt) return 'disabled';
  if (card.expiresAt && card.expiresAt <= now) return 'expired';
  if (card.balance === 0) return 'spent';
  return 'active';
}

const UNUSABLE: Record<Exclude<GiftCardStatus, 'active'>, string> = {
  disabled: 'This gift card is not valid.',
  expired: 'This gift card has expired.',
  spent: 'This gift card has no balance left.',
};

export type UsableCard = { card: GiftCard; error: null } | { card: null; error: string };

/**
 * Gift card balances: lookups by code and every balance change, each recorded as an
 * append-only transaction in the caller's tenant transaction.
 */
@Injectable()
export class GiftCardLedger {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Keyed hash of a normalized code; the plain code is never stored. */
  codeHash(storeId: string, code: string): string {
    return createHmac('sha256', this.env.APP_ENCRYPTION_KEY)
      .update(`gift-card:${storeId}:${normalizeGiftCardCode(code)}`)
      .digest('hex');
  }

  /** Finds a card the shopper can spend in `currency` (no lock; for previews). */
  async findUsable(
    tx: TenantTx,
    storeId: string,
    code: string,
    currency: string,
  ): Promise<UsableCard> {
    const card = await tx.giftCard.findUnique({
      where: { storeId_codeHash: { storeId, codeHash: this.codeHash(storeId, code) } },
    });
    return this.check(card, currency);
  }

  /**
   * Spends up to `maxAmount` from the card for an order, under a row lock so concurrent
   * checkouts can never overspend it. Returns the amount taken.
   */
  async redeem(
    tx: TenantTx,
    storeId: string,
    code: string,
    currency: string,
    maxAmount: number,
    orderId: string,
  ): Promise<UsableCard & { amount: number }> {
    const codeHash = this.codeHash(storeId, code);
    await tx.$queryRaw`SELECT id FROM "GiftCard" WHERE "storeId" = ${storeId}::uuid AND "codeHash" = ${codeHash} FOR UPDATE`;
    const usable = this.check(
      await tx.giftCard.findUnique({ where: { storeId_codeHash: { storeId, codeHash } } }),
      currency,
    );
    if (!usable.card) return { ...usable, amount: 0 };
    const amount = Math.min(usable.card.balance, maxAmount);
    if (amount === 0) return { ...usable, amount };
    const card = await this.apply(tx, usable.card, -amount, 'REDEEMED', { orderId });
    return { card, error: null, amount };
  }

  /** Credits a card (an unpaid order's reservation coming back, or a refund). */
  async credit(
    tx: TenantTx,
    storeId: string,
    giftCardId: string,
    amount: number,
    kind: 'RESTORED' | 'REFUNDED',
    extra: { orderId?: string; actorUserId?: string | null } = {},
  ): Promise<void> {
    if (amount <= 0) return;
    await tx.$queryRaw`SELECT id FROM "GiftCard" WHERE id = ${giftCardId}::uuid AND "storeId" = ${storeId}::uuid FOR UPDATE`;
    const card = await tx.giftCard.findFirstOrThrow({ where: { id: giftCardId, storeId } });
    await this.apply(tx, card, amount, kind, extra);
  }

  /** Changes the balance and records the transaction (caller holds the row lock). */
  async apply(
    tx: TenantTx,
    card: GiftCard,
    amount: number,
    kind: GiftCardTransactionKind,
    extra: { orderId?: string; actorUserId?: string | null; note?: string } = {},
  ): Promise<GiftCard> {
    const updated = await tx.giftCard.update({
      where: { id: card.id },
      data: { balance: card.balance + amount },
    });
    await tx.giftCardTransaction.create({
      data: {
        storeId: card.storeId,
        giftCardId: card.id,
        kind,
        amount,
        balanceAfter: updated.balance,
        orderId: extra.orderId ?? null,
        actorUserId: extra.actorUserId ?? null,
        note: extra.note ?? null,
      },
    });
    return updated;
  }

  private check(card: GiftCard | null, currency: string): UsableCard {
    // Unknown codes and other currencies look the same to the shopper.
    if (!card || card.currency !== currency) return { card: null, error: UNUSABLE.disabled };
    const status = giftCardStatus(card);
    return status === 'active' ? { card, error: null } : { card: null, error: UNUSABLE[status] };
  }
}
