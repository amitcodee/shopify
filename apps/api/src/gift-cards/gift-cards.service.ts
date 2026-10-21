import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  formatGiftCardCode,
  GIFT_CARD_ALPHABET,
  type GiftCard as GiftCardDto,
  type giftCardAdjustInputSchema,
  type GiftCardDetail,
  type giftCardIssueInputSchema,
  type GiftCardListQuery,
  type giftCardUpdateInputSchema,
  type IssuedGiftCard,
  type Paginated,
} from '@repo/contracts';
import { Prisma, type GiftCard, type TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { StoreUrls } from '../orders/store-urls.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { giftCardIssuedEmail } from '../outbox/templates.js';
import { GiftCardLedger, giftCardStatus } from './gift-card-ledger.js';

type IssueInput = z.output<typeof giftCardIssueInputSchema>;
type CardWithCustomer = GiftCard & { customer: { email: string } | null };

/** Random 16-character code: 31^16 ≈ 2^79 possibilities. */
function generateCode(): string {
  return Array.from(
    { length: 16 },
    () => GIFT_CARD_ALPHABET[randomInt(GIFT_CARD_ALPHABET.length)],
  ).join('');
}

/** Cards expire at the end of the chosen day (UTC). */
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999Z`);

@Injectable()
export class GiftCardsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly ledger: GiftCardLedger,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly urls: StoreUrls,
  ) {}

  list(storeId: string, query: GiftCardListQuery): Promise<Paginated<GiftCardDto>> {
    return this.tenantDb.run(storeId, async (tx) => {
      const q = query.q?.replace(/[\s-]/g, '');
      const where: Prisma.GiftCardWhereInput = {
        storeId,
        ...(q
          ? {
              OR: [
                { lastCharacters: { equals: q.slice(-4).toUpperCase() } },
                { customer: { email: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        tx.giftCard.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { customer: { select: { email: true } } },
        }),
        tx.giftCard.count({ where }),
      ]);
      return {
        items: rows.map((c) => this.toDto(c)),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  get(storeId: string, id: string): Promise<GiftCardDetail> {
    return this.tenantDb.run(storeId, (tx) => this.detail(tx, storeId, id));
  }

  issue(
    storeId: string,
    input: IssueInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<IssuedGiftCard> {
    if (input.notifyCustomer && !input.customerEmail) {
      throw new BadRequestException('Add the customer’s email to send them the card.');
    }
    return this.tenantDb.run(storeId, async (tx) => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      const code = input.code ?? generateCode();
      const codeHash = this.ledger.codeHash(storeId, code);
      if (await tx.giftCard.findUnique({ where: { storeId_codeHash: { storeId, codeHash } } })) {
        throw new ConflictException('A gift card with this code already exists.');
      }
      const customer = input.customerEmail
        ? await tx.customer.upsert({
            where: { storeId_email: { storeId, email: input.customerEmail } },
            update: {},
            create: { storeId, email: input.customerEmail },
          })
        : null;
      const card = await tx.giftCard.create({
        data: {
          storeId,
          codeHash,
          lastCharacters: code.slice(-4),
          initialValue: input.initialValue,
          balance: 0,
          currency: store.currency,
          customerId: customer?.id ?? null,
          note: input.note ?? null,
          expiresAt: input.expiresOn ? endOfDay(input.expiresOn) : null,
        },
      });
      const issued = await this.ledger.apply(tx, card, input.initialValue, 'ISSUED', {
        actorUserId: actor.id,
      });
      if (input.notifyCustomer && customer) {
        const primary = await tx.domain.findFirst({
          where: { storeId, isPrimary: true, verifiedAt: { not: null } },
        });
        await this.outbox.enqueueEmail(
          tx,
          storeId,
          giftCardIssuedEmail(customer.email, {
            storeName: store.name,
            code: formatGiftCardCode(code),
            value: input.initialValue,
            currency: store.currency,
            expiresOn: input.expiresOn ?? null,
            shopUrl: this.urls.storefrontOrigin(store.subdomain, primary?.hostname),
          }),
        );
      }
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'gift_card.issued',
        entityType: 'gift_card',
        entityId: card.id,
        data: { value: input.initialValue, lastCharacters: card.lastCharacters },
        meta,
      });
      return {
        ...this.toDto({ ...issued, customer: customer ? { email: customer.email } : null }),
        code: formatGiftCardCode(code),
      };
    });
  }

  update(
    storeId: string,
    id: string,
    input: z.output<typeof giftCardUpdateInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<GiftCardDetail> {
    return this.tenantDb.run(storeId, async (tx) => {
      const card = await this.find(tx, storeId, id);
      await tx.giftCard.update({
        where: { id: card.id },
        data: {
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.expiresOn !== undefined
            ? { expiresAt: input.expiresOn ? endOfDay(input.expiresOn) : null }
            : {}),
          ...(input.disabled !== undefined
            ? { disabledAt: input.disabled ? (card.disabledAt ?? new Date()) : null }
            : {}),
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: input.disabled ? 'gift_card.disabled' : 'gift_card.updated',
        entityType: 'gift_card',
        entityId: id,
        data: input,
        meta,
      });
      return this.detail(tx, storeId, id);
    });
  }

  adjust(
    storeId: string,
    id: string,
    input: z.output<typeof giftCardAdjustInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<GiftCardDetail> {
    return this.tenantDb.run(storeId, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "GiftCard" WHERE id = ${id}::uuid AND "storeId" = ${storeId}::uuid FOR UPDATE`;
      const card = await this.find(tx, storeId, id);
      if (card.balance + input.amount < 0) {
        throw new BadRequestException(`The balance is only ${card.balance}.`);
      }
      await this.ledger.apply(tx, card, input.amount, 'ADJUSTED', {
        actorUserId: actor.id,
        note: input.note,
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'gift_card.adjusted',
        entityType: 'gift_card',
        entityId: id,
        data: { amount: input.amount, note: input.note },
        meta,
      });
      return this.detail(tx, storeId, id);
    });
  }

  private async find(tx: TenantTx, storeId: string, id: string): Promise<GiftCard> {
    const card = await tx.giftCard.findFirst({ where: { id, storeId } });
    if (!card) throw new NotFoundException('Gift card not found.');
    return card;
  }

  private async detail(tx: TenantTx, storeId: string, id: string): Promise<GiftCardDetail> {
    const card = await tx.giftCard.findFirst({
      where: { id, storeId },
      include: {
        customer: { select: { email: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 200 },
      },
    });
    if (!card) throw new NotFoundException('Gift card not found.');
    const orderIds = card.transactions.flatMap((t) => (t.orderId ? [t.orderId] : []));
    const orders = await tx.order.findMany({
      where: { storeId, id: { in: orderIds } },
      select: { id: true, number: true },
    });
    const numbers = new Map(orders.map((o) => [o.id, o.number]));
    return {
      ...this.toDto(card),
      transactions: card.transactions.map((t) => ({
        id: t.id,
        kind: t.kind,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        order:
          t.orderId && numbers.has(t.orderId)
            ? { id: t.orderId, number: numbers.get(t.orderId) ?? 0 }
            : null,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  private toDto(card: CardWithCustomer): GiftCardDto {
    return {
      id: card.id,
      lastCharacters: card.lastCharacters,
      initialValue: card.initialValue,
      balance: card.balance,
      currency: card.currency,
      status: giftCardStatus(card),
      customerEmail: card.customer?.email ?? null,
      note: card.note,
      expiresOn: card.expiresAt?.toISOString().slice(0, 10) ?? null,
      createdAt: card.createdAt.toISOString(),
    };
  }
}
