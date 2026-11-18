import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  addressSchema,
  amountInWords,
  financialYearOf,
  GST_STATES,
  type GstRegistration,
  gstRegistrationInputSchema,
  gstRegistrationSchema,
  type GstSettings,
  gstStateFor,
  invoiceNumber,
  type OrderInvoice,
  type OrderInvoiceState,
  type TaxInvoiceData,
  taxInvoiceDataSchema,
  type TaxInvoiceLine,
} from '@repo/contracts';
import {
  Prisma,
  type Order,
  type OrderInvoice as OrderInvoiceRow,
  type OrderLine,
  type TenantTx,
} from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { Public } from '../auth/auth.guard.js';
import { hashToken } from '../auth/session.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { TenantDb } from '../database/database.module.js';
import { allocate } from '../checkout/pricing.js';
import { AllowLockedStore, CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

type RegistrationInput = z.output<typeof gstRegistrationInputSchema>;

/** The store's GST registration, or null when it has none (or the stored JSON is unusable). */
export function parseRegistration(value: unknown): GstRegistration | null {
  const parsed = gstRegistrationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function registrationFromInput(input: RegistrationInput): GstRegistration {
  const state = GST_STATES.find((s) => s.code === input.gstin.slice(0, 2));
  if (!state) throw new BadRequestException('Unknown GST state code.');
  return { ...input, stateCode: state.code, stateName: state.name };
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on delivery',
  manual: 'Paid outside the platform',
  none: 'No payment due',
};

function split(tax: number, rateBps: number, intra: boolean) {
  const cgst = intra ? Math.floor(tax / 2) : 0;
  return { rateBps, cgst, sgst: intra ? tax - cgst : 0, igst: intra ? 0 : tax };
}

export interface InvoiceSource {
  store: { name: string; contactEmail: string };
  registration: GstRegistration;
  order: Order & { lines: OrderLine[] };
}

/**
 * Everything printed on a GST invoice, from the order as sold. Orders placed before per-line
 * tax was stored (all lines 0 while the order has tax) get the order's tax split by value.
 */
export function buildTaxInvoice({ store, registration, order }: InvoiceSource): TaxInvoiceData {
  const address = addressSchema.safeParse(order.shippingAddress);
  const a = address.success ? address.data : null;
  const exported = a !== null && a.country !== 'IN';
  const state = a && !exported ? gstStateFor(a.region) : null;
  const intra = !exported && state?.code === registration.stateCode;
  const supplyType = exported ? 'export' : intra ? 'intra' : 'inter';

  const lines = order.lines.filter((l) => l.quantity > 0);
  const bases = lines.map((l) => l.unitPrice * l.quantity - l.discountTotal);
  let lineTaxes = lines.map((l) => l.taxTotal);
  let lineRates = lines.map((l) => l.taxRateBps);
  let shippingTax = order.shippingTaxTotal;
  const stored = lineTaxes.reduce((s, t) => s + t, 0) + shippingTax;
  if (stored !== order.taxTotal) {
    const weights = lines.map((l, i) => (l.taxable ? (bases[i] ?? 0) : 0));
    if (weights.some((w) => w > 0)) {
      lineTaxes = allocate(order.taxTotal, weights);
      shippingTax = 0;
    } else {
      lineTaxes = lines.map(() => 0);
      shippingTax = order.taxTotal;
    }
    lineRates = lines.map((_, i) => {
      const base = weights[i] ?? 0;
      return base > 0 ? Math.round(((lineTaxes[i] ?? 0) * 10_000) / base) : 0;
    });
  }

  const invoiceLines: TaxInvoiceLine[] = lines.map((l, i) => {
    const tax = lineTaxes[i] ?? 0;
    const taxableValue = bases[i] ?? 0;
    return {
      description:
        l.variantTitle && l.variantTitle !== 'Default' ? `${l.title} (${l.variantTitle})` : l.title,
      sku: l.sku,
      hsCode: l.hsCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discountTotal,
      taxableValue,
      total: taxableValue + tax,
      ...split(tax, lineRates[i] ?? 0, intra),
    };
  });
  const shippingRate =
    order.shippingTotal > 0 && shippingTax > 0
      ? Math.round((shippingTax * 10_000) / order.shippingTotal)
      : 0;
  const shipping =
    order.shippingTotal > 0
      ? {
          description: order.shippingMethod ?? 'Shipping',
          taxableValue: order.shippingTotal,
          ...split(shippingTax, shippingRate, intra),
        }
      : null;

  const summary = new Map<string, TaxInvoiceData['summary'][number]>();
  const rows = [
    ...invoiceLines.map((l) => ({ ...l, hsCode: l.hsCode })),
    ...(shipping ? [{ ...shipping, hsCode: '9965' }] : []),
  ];
  for (const row of rows) {
    const key = `${row.hsCode ?? ''}|${row.rateBps}`;
    const entry = summary.get(key) ?? {
      hsCode: row.hsCode,
      rateBps: row.rateBps,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    entry.taxableValue += row.taxableValue;
    entry.cgst += row.cgst;
    entry.sgst += row.sgst;
    entry.igst += row.igst;
    summary.set(key, entry);
  }
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);

  const regionName = state?.name ?? a?.region ?? '';
  return {
    seller: {
      storeName: store.name,
      legalName: registration.legalName,
      gstin: registration.gstin,
      address: registration.address,
      stateCode: registration.stateCode,
      stateName: registration.stateName,
      email: store.contactEmail,
    },
    buyer: {
      name: a?.name ?? order.email,
      email: order.email,
      phone: a?.phone ?? null,
      address: a
        ? [
            a.line1,
            a.line2 ?? '',
            [a.city, a.region ?? '', a.postalCode].filter(Boolean).join(', '),
            a.country,
          ].filter(Boolean)
        : [],
    },
    placeOfSupply: exported
      ? { code: '96', name: `Outside India (${a?.country ?? ''})` }
      : { code: state?.code ?? null, name: regionName || 'Not given' },
    supplyType,
    orderNumber: order.number,
    orderDate: order.createdAt.toISOString(),
    currency: order.currency,
    lines: invoiceLines,
    shipping,
    summary: [...summary.values()],
    taxableTotal: sum((r) => r.taxableValue),
    cgstTotal: sum((r) => r.cgst),
    sgstTotal: sum((r) => r.sgst),
    igstTotal: sum((r) => r.igst),
    total: order.total,
    giftCardAmount: order.giftCardAmount,
    amountInWords: amountInWords(order.total, order.currency),
    paymentMethod: PAYMENT_LABELS[order.paymentProvider] ?? `Online (${order.paymentProvider})`,
    paid: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.financialStatus),
  };
}

function toInvoice(row: OrderInvoiceRow): OrderInvoice {
  return {
    id: row.id,
    number: row.number,
    financialYear: row.financialYear,
    issuedAt: row.issuedAt.toISOString(),
    data: taxInvoiceDataSchema.parse(row.data),
  };
}

/** Year and month (1-12) of an instant in a time zone. */
function yearMonthIn(date: Date, timeZone: string): { year: number; month: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month') };
}

/** Why an order cannot get an invoice now, or null when it can. */
function ineligibility(order: Pick<Order, 'status'>, registration: GstRegistration | null) {
  if (!registration) return 'Add your GSTIN in Settings → Taxes to issue tax invoices.';
  if (order.status === 'CANCELLED') return 'Cancelled orders do not get a tax invoice.';
  if (order.status !== 'OPEN') return 'The invoice is issued once the order is paid or confirmed.';
  return null;
}

/**
 * Issues GST invoices. Numbers run without gaps per store and financial year (a transaction
 * lock serialises issuing), and an issued invoice never changes.
 */
@Injectable()
export class TaxInvoiceIssuer {
  /** Issues the order's invoice if the store is GST-registered and it has none yet. */
  async issue(tx: TenantTx, storeId: string, orderId: string): Promise<OrderInvoiceRow | null> {
    return (await this.issueNew(tx, storeId, orderId)).invoice;
  }

  /** Like issue(), and says whether this call created it. */
  async issueNew(
    tx: TenantTx,
    storeId: string,
    orderId: string,
  ): Promise<{ invoice: OrderInvoiceRow | null; created: boolean }> {
    const existing = await tx.orderInvoice.findUnique({
      where: { storeId_orderId: { storeId, orderId } },
    });
    if (existing) return { invoice: existing, created: false };
    const store = await tx.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { name: true, contactEmail: true, timezone: true, gstRegistration: true },
    });
    const registration = parseRegistration(store.gstRegistration);
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
      include: { lines: true },
    });
    if (!order || ineligibility(order, registration) || !registration) {
      return { invoice: null, created: false };
    }

    const issuedAt = new Date();
    const { year, month } = yearMonthIn(issuedAt, store.timezone);
    const financialYear = financialYearOf(year, month);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${storeId}:${financialYear}`}))`;
    const last = await tx.orderInvoice.aggregate({
      where: { storeId, financialYear },
      _max: { sequence: true },
    });
    const sequence = (last._max.sequence ?? 0) + 1;
    const data = buildTaxInvoice({ store, registration, order });
    const invoice = await tx.orderInvoice.create({
      data: {
        storeId,
        orderId,
        financialYear,
        sequence,
        number: invoiceNumber(registration.invoicePrefix, financialYear, sequence),
        issuedAt,
        data: data,
      },
    });
    return { invoice, created: true };
  }
}

@Injectable()
export class TaxInvoicesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly issuer: TaxInvoiceIssuer,
    private readonly audit: AuditService,
  ) {}

  getSettings(storeId: string): Promise<GstSettings> {
    return this.tenantDb.run(storeId, async (tx) => {
      const store = await tx.store.findUniqueOrThrow({
        where: { id: storeId },
        select: { gstRegistration: true },
      });
      return { registration: parseRegistration(store.gstRegistration) };
    });
  }

  async saveSettings(
    storeId: string,
    input: RegistrationInput | null,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<GstSettings> {
    const registration = input ? registrationFromInput(input) : null;
    await this.tenantDb.run(storeId, async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: { gstRegistration: registration ?? Prisma.DbNull },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: registration ? 'tax.gst_saved' : 'tax.gst_removed',
        entityType: 'tax',
        entityId: storeId,
        data: registration ? { gstin: registration.gstin } : undefined,
        meta,
      });
    });
    return { registration };
  }

  orderInvoice(storeId: string, orderId: string): Promise<OrderInvoiceState> {
    return this.tenantDb.run(storeId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, storeId },
        select: { status: true, invoice: true, store: { select: { gstRegistration: true } } },
      });
      if (!order) throw new NotFoundException('Order not found.');
      if (order.invoice)
        return { invoice: toInvoice(order.invoice), canIssue: false, reason: null };
      const reason = ineligibility(order, parseRegistration(order.store.gstRegistration));
      return { invoice: null, canIssue: reason === null, reason };
    });
  }

  async issue(storeId: string, orderId: string, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, storeId },
        select: {
          status: true,
          invoice: { select: { id: true } },
          store: { select: { gstRegistration: true } },
        },
      });
      if (!order) throw new NotFoundException('Order not found.');
      const reason = order.invoice
        ? null
        : ineligibility(order, parseRegistration(order.store.gstRegistration));
      if (reason) throw new BadRequestException(reason);
      const row = await this.issuer.issue(tx, storeId, orderId);
      if (!row) throw new BadRequestException('This order cannot get a tax invoice.');
      if (!order.invoice) {
        await this.audit.record(tx, {
          storeId,
          actorUserId: actor.id,
          action: 'order.invoice_issued',
          entityType: 'order',
          entityId: orderId,
          data: { number: row.number },
          meta,
        });
      }
      return { invoice: toInvoice(row), canIssue: false, reason: null } satisfies OrderInvoiceState;
    });
  }

  /** The shopper's copy, found by the order-status token. Null when none was issued. */
  publicInvoice(shop: ShopContext, token: string): Promise<OrderInvoice> {
    return this.tenantDb.run(shop.id, async (tx) => {
      const order = await tx.order.findFirst({
        where: { storeId: shop.id, accessTokenHash: hashToken(token) },
        select: { invoice: true },
      });
      if (!order?.invoice) throw new NotFoundException('No tax invoice for this order.');
      return toInvoice(order.invoice);
    });
  }
}

const gstSettingsBodySchema = gstRegistrationInputSchema;

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class TaxInvoicesController {
  constructor(private readonly invoices: TaxInvoicesService) {}

  @Get('gst')
  @RequirePermission('settings:read')
  gst(@CurrentStore() store: StoreContext): Promise<GstSettings> {
    return this.invoices.getSettings(store.id);
  }

  @Put('gst')
  @RequirePermission('settings:write')
  @ApiZodBody(gstSettingsBodySchema)
  saveGst(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(gstSettingsBodySchema)) body: RegistrationInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<GstSettings> {
    return this.invoices.saveSettings(store.id, body, user, meta);
  }

  @Delete('gst')
  @RequirePermission('settings:write')
  removeGst(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<GstSettings> {
    return this.invoices.saveSettings(store.id, null, user, meta);
  }

  @Get('orders/:orderId/invoice')
  @RequirePermission('orders:read')
  invoice(
    @CurrentStore() store: StoreContext,
    @Param('orderId', UuidParam) orderId: string,
  ): Promise<OrderInvoiceState> {
    return this.invoices.orderInvoice(store.id, orderId);
  }

  @Post('orders/:orderId/invoice')
  @HttpCode(200)
  @RequirePermission('orders:write')
  issueInvoice(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('orderId', UuidParam) orderId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<OrderInvoiceState> {
    return this.invoices.issue(store.id, orderId, user, meta);
  }
}

@ApiTags('Storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront')
export class StorefrontInvoicesController {
  constructor(private readonly invoices: TaxInvoicesService) {}

  @AllowLockedStore()
  @Get('orders/:token/invoice')
  invoice(@CurrentShop() shop: ShopContext, @Param('token') token: string): Promise<OrderInvoice> {
    return this.invoices.publicInvoice(shop, token.slice(0, 200));
  }
}
