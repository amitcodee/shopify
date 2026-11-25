import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  creditNoteDataSchema,
  financialYearOf,
  gstOn,
  GST_DOCUMENTS_PAGE_SIZE,
  type GstDocuments,
  gstMonthSchema,
  type Gstr1Report,
  type TaxInvoiceData,
  taxInvoiceDataSchema,
} from '@repo/contracts';
import { z } from 'zod';
import type { StoreContext } from '../common/request.js';
import { CurrentStore } from '../common/request.js';
import { ZodPipe } from '../common/zod.js';
import type { TenantTx } from '@repo/db';
import { TenantDb } from '../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { parseRegistration } from './tax-invoices.js';

/** Other-state consumer invoices above this (Rs 1 lakh, in paise) are reported one by one. */
export const B2CL_LIMIT = 100_000_00;

export interface IssuedDocument {
  number: string;
  issuedAt: Date;
  data: unknown;
}

export interface CreditNoteDocument extends IssuedDocument {
  /** The invoice the note reduces. */
  invoice: IssuedDocument | null;
  /** Cancelled because its refund failed: left out of the tables, counted in table 13. */
  cancelled?: boolean;
}

/** YYYY-MM-DD of an instant in a time zone. */
function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

type Kind = 'b2b' | 'b2cl' | 'export' | 'b2cs';

/** Which GSTR-1 table an invoice belongs to. */
function kindOf(d: TaxInvoiceData): Kind {
  if (d.buyer.gstin) return 'b2b';
  if (d.supplyType === 'export') return 'export';
  if (d.supplyType === 'inter' && d.currency === 'INR' && d.total > B2CL_LIMIT) return 'b2cl';
  return 'b2cs';
}

/** Place of supply for a domestic invoice; same-state sales without a known state use the seller's. */
type Placed = Pick<TaxInvoiceData, 'placeOfSupply' | 'supplyType' | 'seller'>;

function placeOf(d: Placed) {
  if (d.placeOfSupply.code) return d.placeOfSupply;
  if (d.supplyType === 'intra') return { code: d.seller.stateCode, name: d.seller.stateName };
  return d.placeOfSupply;
}

const isService = (hsCode: string | null) => hsCode?.startsWith('99') ?? false;

/**
 * Sorts a month's invoices and credit notes into GSTR-1 tables. Rows with no value (a credit
 * note's untouched rates) are left out. B2C small sales and both HSN summaries are net of the
 * month's credit notes; quantities are not, since a credit note records an amount.
 */
export function buildGstr1(input: {
  month: string;
  timeZone: string;
  registration: { gstin: string; legalName: string } | null;
  invoices: IssuedDocument[];
  creditNotes: CreditNoteDocument[];
}): Gstr1Report {
  const { timeZone } = input;
  const report: Gstr1Report = {
    month: input.month,
    gstin: input.registration?.gstin ?? null,
    legalName: input.registration?.legalName ?? null,
    currency: 'INR',
    b2b: [],
    b2cl: [],
    exports: [],
    b2cs: [],
    cdnr: [],
    cdnur: [],
    hsn: [],
    documents: [],
    totals: { invoices: 0, creditNotes: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
    gstr3b: {
      outwardTaxable: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
      zeroRated: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
      nilRated: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
      interStateUnregistered: [],
      inwardReverseCharge: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
      itc: {
        igst: 0,
        cgst: 0,
        sgst: 0,
        reverseCharge: { igst: 0, cgst: 0, sgst: 0 },
        purchases: [],
      },
    },
    warnings: [],
  };
  const currencies = new Set<string>();
  const sellerGstins = new Set<string>();
  let missingHsn = 0;
  let unknownPlace = 0;
  let testPayments = 0;

  const b2cs = new Map<string, Gstr1Report['b2cs'][number]>();
  const addB2cs = (
    d: Placed,
    row: { rateBps: number; taxableValue: number; igst: number; cgst: number; sgst: number },
    sign: 1 | -1,
  ) => {
    const place = placeOf(d);
    const supplyType = d.supplyType === 'intra' ? 'intra' : 'inter';
    const key = `${supplyType}|${place.code ?? ''}|${row.rateBps}`;
    const entry = b2cs.get(key) ?? {
      supplyType,
      placeOfSupply: place,
      rateBps: row.rateBps,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
    };
    entry.taxableValue += sign * row.taxableValue;
    entry.igst += sign * row.igst;
    entry.cgst += sign * row.cgst;
    entry.sgst += sign * row.sgst;
    b2cs.set(key, entry);
  };

  const hsn = new Map<string, Gstr1Report['hsn'][number]>();
  const addHsn = (
    audience: 'b2b' | 'b2c',
    row: {
      hsCode: string | null;
      description: string;
      quantity: number;
      rateBps: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
    },
    sign: 1 | -1,
  ) => {
    const key = `${audience}|${row.hsCode ?? ''}|${row.rateBps}`;
    const service = isService(row.hsCode);
    const entry = hsn.get(key) ?? {
      audience,
      hsCode: row.hsCode,
      description: row.description,
      uqc: service ? 'NA' : 'NOS',
      quantity: 0,
      totalValue: 0,
      rateBps: row.rateBps,
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
    };
    if (!service) entry.quantity += sign * row.quantity;
    entry.taxableValue += sign * row.taxableValue;
    entry.igst += sign * row.igst;
    entry.cgst += sign * row.cgst;
    entry.sgst += sign * row.sgst;
    entry.totalValue = entry.taxableValue + entry.igst + entry.cgst + entry.sgst;
    hsn.set(key, entry);
  };

  type Amounts = { taxableValue: number; igst: number; cgst: number; sgst: number };
  const add = (into: Amounts, r: Amounts, sign: 1 | -1) => {
    into.taxableValue += sign * r.taxableValue;
    into.igst += sign * r.igst;
    into.cgst += sign * r.cgst;
    into.sgst += sign * r.sgst;
  };
  const interUnregistered = new Map<
    string,
    Gstr1Report['gstr3b']['interStateUnregistered'][number]
  >();
  /** Adds a document's rows to the month totals and to the GSTR-3B tables 3.1 and 3.2. */
  const addTotals = (
    rows: (Amounts & { rateBps: number })[],
    sign: 1 | -1,
    doc: Placed & { kind: Kind },
  ) => {
    const b = report.gstr3b;
    for (const r of rows) {
      add(report.totals, r, sign);
      if (doc.kind === 'export') add(b.zeroRated, r, sign);
      else if (r.rateBps === 0) add(b.nilRated, r, sign);
      else add(b.outwardTaxable, r, sign);
      if (doc.kind !== 'b2b' && doc.kind !== 'export' && doc.supplyType === 'inter') {
        const place = placeOf(doc);
        const entry = interUnregistered.get(place.code ?? '') ?? {
          placeOfSupply: place,
          taxableValue: 0,
          igst: 0,
        };
        entry.taxableValue += sign * r.taxableValue;
        entry.igst += sign * r.igst;
        interUnregistered.set(place.code ?? '', entry);
      }
    }
  };

  const invoices = [...input.invoices].sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
  for (const invoice of invoices) {
    const d = taxInvoiceDataSchema.parse(invoice.data);
    currencies.add(d.currency);
    sellerGstins.add(d.seller.gstin);
    if (d.paymentMethod.includes('test')) testPayments++;
    const kind = kindOf(d);
    const date = localDate(invoice.issuedAt, timeZone);
    const rows = d.summary.filter((r) => r.taxableValue !== 0 || r.igst + r.cgst + r.sgst !== 0);
    if (kind !== 'export' && !placeOf(d).code) unknownPlace++;
    report.totals.invoices++;
    addTotals(rows, 1, { ...d, kind });

    // Rows of the same rate (different HSN codes) are one row in the invoice tables.
    const byRate = new Map<
      number,
      { taxableValue: number; igst: number; cgst: number; sgst: number }
    >();
    for (const r of rows) {
      const e = byRate.get(r.rateBps) ?? { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
      e.taxableValue += r.taxableValue;
      e.igst += r.igst;
      e.cgst += r.cgst;
      e.sgst += r.sgst;
      byRate.set(r.rateBps, e);
    }
    for (const [rateBps, r] of byRate) {
      const head = { invoiceNumber: invoice.number, invoiceDate: date, invoiceValue: d.total };
      if (kind === 'b2b') {
        report.b2b.push({
          gstin: d.buyer.gstin ?? '',
          name: d.buyer.legalName ?? d.buyer.name,
          ...head,
          placeOfSupply: placeOf(d),
          rateBps,
          ...r,
        });
      } else if (kind === 'b2cl') {
        report.b2cl.push({
          ...head,
          placeOfSupply: placeOf(d),
          rateBps,
          taxableValue: r.taxableValue,
          igst: r.igst,
        });
      } else if (kind === 'export') {
        report.exports.push({
          exportType: d.igstTotal > 0 ? 'WPAY' : 'WOPAY',
          ...head,
          rateBps,
          taxableValue: r.taxableValue,
          igst: r.igst,
        });
      } else {
        addB2cs(d, { rateBps, ...r }, 1);
      }
    }

    // HSN summary: product lines (with quantities) and shipping as SAC 9965.
    const audience = kind === 'b2b' ? 'b2b' : 'b2c';
    for (const l of d.lines) {
      if (!l.hsCode) missingHsn++;
      addHsn(audience, { ...l, description: l.description }, 1);
    }
    if (
      d.shipping &&
      d.shipping.taxableValue + d.shipping.igst + d.shipping.cgst + d.shipping.sgst > 0
    ) {
      addHsn(
        audience,
        { ...d.shipping, hsCode: '9965', description: 'Goods transport (shipping)', quantity: 0 },
        1,
      );
    }
  }

  const allNotes = [...input.creditNotes].sort(
    (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime(),
  );
  const notes = allNotes.filter((n) => !n.cancelled);
  for (const note of notes) {
    const n = creditNoteDataSchema.parse(note.data);
    currencies.add(n.currency);
    const original = note.invoice ? taxInvoiceDataSchema.parse(note.invoice.data) : null;
    // Classify by the invoice it reduces (its value decides B2CL); fall back to the note itself.
    const kind: Kind = original
      ? kindOf(original)
      : n.buyer.gstin
        ? 'b2b'
        : n.supplyType === 'export'
          ? 'export'
          : 'b2cs';
    const date = localDate(note.issuedAt, timeZone);
    const rows = n.rows.filter((r) => r.taxableValue !== 0 || r.igst + r.cgst + r.sgst !== 0);
    report.totals.creditNotes++;
    addTotals(rows, -1, { ...n, kind });
    for (const r of rows) {
      const head = {
        noteNumber: note.number,
        noteDate: date,
        invoiceNumber: n.invoiceNumber,
        placeOfSupply: placeOf(n),
        noteValue: n.total,
        rateBps: r.rateBps,
      };
      if (kind === 'b2b') {
        report.cdnr.push({
          gstin: n.buyer.gstin ?? '',
          name: n.buyer.legalName ?? n.buyer.name,
          ...head,
          taxableValue: r.taxableValue,
          igst: r.igst,
          cgst: r.cgst,
          sgst: r.sgst,
        });
      } else if (kind === 'b2cl' || kind === 'export') {
        report.cdnur.push({
          urType:
            kind === 'b2cl' ? 'B2CL' : (original?.igstTotal ?? r.igst) > 0 ? 'EXPWP' : 'EXPWOP',
          ...head,
          taxableValue: r.taxableValue,
          igst: r.igst,
        });
      } else {
        addB2cs(n, r, -1);
      }
      const description =
        original?.lines.find((l) => l.hsCode === r.hsCode)?.description ??
        (r.hsCode === '9965' ? 'Goods transport (shipping)' : 'Returned items');
      addHsn(kind === 'b2b' ? 'b2b' : 'b2c', { ...r, description, quantity: 0 }, -1);
    }
  }

  report.b2cs = [...b2cs.values()]
    .filter((r) => r.taxableValue !== 0 || r.igst + r.cgst + r.sgst !== 0)
    .sort(
      (a, b) =>
        (a.placeOfSupply.code ?? '').localeCompare(b.placeOfSupply.code ?? '') ||
        a.rateBps - b.rateBps,
    );
  report.hsn = [...hsn.values()].sort(
    (a, b) =>
      a.audience.localeCompare(b.audience) ||
      (a.hsCode ?? '').localeCompare(b.hsCode ?? '') ||
      a.rateBps - b.rateBps,
  );
  report.gstr3b.interStateUnregistered = [...interUnregistered.values()]
    .filter((r) => r.taxableValue !== 0 || r.igst !== 0)
    .sort((a, b) => (a.placeOfSupply.code ?? '').localeCompare(b.placeOfSupply.code ?? ''));
  report.documents = [...series(invoices, 'invoice'), ...series(allNotes, 'credit_note')];

  const [only] = currencies;
  if (currencies.size === 1 && only) report.currency = only;
  if (currencies.size > 1 || (only && only !== 'INR')) {
    report.warnings.push(
      `Some documents are in ${[...currencies].filter((c) => c !== 'INR').join(', ')}, not rupees. GST returns are filed in INR: convert these amounts at the rate on the invoice date before filing.`,
    );
  }
  if (sellerGstins.size > 1) {
    report.warnings.push(
      `Invoices this month carry ${sellerGstins.size} different GSTINs (${[...sellerGstins].join(', ')}). Each GSTIN files its own return.`,
    );
  }
  if (missingHsn > 0) {
    report.warnings.push(
      `${missingHsn} invoice line${missingHsn === 1 ? ' has' : 's have'} no HSN code, so ${missingHsn === 1 ? 'it shows' : 'they show'} with a blank HSN in the summary. Add HSN codes on the product pages (new orders pick them up).`,
    );
  }
  if (unknownPlace > 0) {
    report.warnings.push(
      `${unknownPlace} invoice${unknownPlace === 1 ? '' : 's'} to another state had no recognised Indian state, so the place of supply is blank. Fill it in before filing.`,
    );
  }
  const cancelledNotes = allNotes.length - notes.length;
  if (cancelledNotes > 0) {
    report.warnings.push(
      `${cancelledNotes} credit note${cancelledNotes === 1 ? ' was' : 's were'} cancelled because the refund failed. ${cancelledNotes === 1 ? 'It is' : 'They are'} counted as cancelled in table 13 and left out of the other tables; if you already filed this month, amend the return.`,
    );
  }
  if (testPayments > 0) {
    report.warnings.push(
      `${testPayments} invoice${testPayments === 1 ? ' is' : 's are'} for test-mode payments. They are numbered invoices: report them, or issue credit notes if the orders were not real sales.`,
    );
  }
  return report;
}

export interface PurchaseForItc {
  id: string;
  number: number;
  supplierName: string;
  supplierGstin: string;
  supplierReference: string;
  /** YYYY-MM-DD from the supplier's tax invoice. */
  invoiceDate: string;
  shippingCost: number;
  shippingTaxRateBps: number;
  reverseCharge: boolean;
  lines: { receivedQuantity: number; unitCost: number; taxRateBps: number }[];
}

/**
 * GSTR-3B table 4: GST on stock received from registered suppliers, one row per supplier
 * invoice. Same-state suppliers (first two GSTIN digits) charge CGST + SGST, others IGST. Units
 * not yet received are left out: credit needs the goods as well as the invoice. Reverse-charge
 * purchases go to 3.1(d) (tax the store pays) and their credit to 4(A)(3); a supplier without a
 * GSTIN is treated as same-state.
 */
export function buildItc(
  storeGstin: string | null,
  purchases: readonly PurchaseForItc[],
): {
  itc: Gstr1Report['gstr3b']['itc'];
  inwardReverseCharge: Gstr1Report['gstr3b']['inwardReverseCharge'];
  warnings: string[];
} {
  const itc: Gstr1Report['gstr3b']['itc'] = {
    igst: 0,
    cgst: 0,
    sgst: 0,
    reverseCharge: { igst: 0, cgst: 0, sgst: 0 },
    purchases: [],
  };
  const inwardReverseCharge = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
  const warnings: string[] = [];
  if (!storeGstin) return { itc, inwardReverseCharge, warnings };
  let unregistered = 0;
  const sorted = [...purchases].sort(
    (a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.number - b.number,
  );
  for (const p of sorted) {
    const received = p.lines.filter((l) => l.receivedQuantity > 0);
    if (received.length === 0) continue;
    const parts = [
      ...received.map((l) => ({ amount: l.receivedQuantity * l.unitCost, rateBps: l.taxRateBps })),
      { amount: p.shippingCost, rateBps: p.shippingTaxRateBps },
    ];
    if (parts.every((x) => x.rateBps === 0 || x.amount === 0)) continue;
    if (!p.supplierGstin && !p.reverseCharge) {
      unregistered++;
      continue;
    }
    const intra = !p.supplierGstin || p.supplierGstin.slice(0, 2) === storeGstin.slice(0, 2);
    const row = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
    for (const x of parts) {
      row.taxableValue += x.amount;
      if (intra) {
        row.cgst += gstOn(x.amount, x.rateBps / 2);
        row.sgst += gstOn(x.amount, x.rateBps / 2);
      } else {
        row.igst += gstOn(x.amount, x.rateBps);
      }
    }
    const credit = p.reverseCharge ? itc.reverseCharge : itc;
    credit.igst += row.igst;
    credit.cgst += row.cgst;
    credit.sgst += row.sgst;
    if (p.reverseCharge) {
      inwardReverseCharge.taxableValue += row.taxableValue;
      inwardReverseCharge.igst += row.igst;
      inwardReverseCharge.cgst += row.cgst;
      inwardReverseCharge.sgst += row.sgst;
    }
    itc.purchases.push({
      purchaseOrderId: p.id,
      purchaseOrder: `#PO${p.number}`,
      supplierName: p.supplierName,
      supplierGstin: p.supplierGstin,
      invoiceNumber: p.supplierReference,
      invoiceDate: p.invoiceDate,
      reverseCharge: p.reverseCharge,
      ...row,
    });
  }
  if (unregistered > 0) {
    warnings.push(
      `${unregistered} purchase order${unregistered === 1 ? ' carries' : 's carry'} GST from a supplier with no GSTIN, so no input tax credit is counted. Add the supplier's GSTIN if they are registered.`,
    );
  }
  if (itc.purchases.some((r) => !r.invoiceNumber)) {
    warnings.push(
      'Some purchases in the input tax credit have no supplier invoice number. Add it on the purchase order so you can match it with GSTR-2B.',
    );
  }
  if (inwardReverseCharge.igst + inwardReverseCharge.cgst + inwardReverseCharge.sgst > 0) {
    warnings.push(
      'Reverse-charge GST (3.1(d)) must be paid in cash before its credit (4(A)(3)) can be used.',
    );
  }
  return { itc, inwardReverseCharge, warnings };
}

/** Number ranges per series ("INV/26-27/"), in issue order. Only credit notes get cancelled. */
function series(
  docs: (IssuedDocument & { cancelled?: boolean })[],
  nature: 'invoice' | 'credit_note',
) {
  const groups = new Map<string, { numbers: string[]; cancelled: number }>();
  for (const doc of docs) {
    const prefix = doc.number.replace(/\d+$/, '');
    const group = groups.get(prefix) ?? { numbers: [], cancelled: 0 };
    group.numbers.push(doc.number);
    if (doc.cancelled) group.cancelled++;
    groups.set(prefix, group);
  }
  return [...groups.values()].map(({ numbers, cancelled }) => {
    const sorted = [...numbers].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    return {
      nature,
      from: sorted[0] ?? '',
      to: sorted.at(-1) ?? '',
      total: sorted.length,
      cancelled,
    };
  });
}

/** The zone if the database will accept it (the setting is free text), otherwise UTC. */
function knownTimeZone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

const querySchema = z.object({ month: gstMonthSchema.optional() });
const documentsQuerySchema = querySchema.extend({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

@Injectable()
export class GstReturnsService {
  constructor(private readonly tenantDb: TenantDb) {}

  /** The month (default: this month in the store's time zone) and its document filter. */
  private async period(tx: TenantTx, storeId: string, month?: string) {
    const store = await tx.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { timezone: true, gstRegistration: true },
    });
    const timeZone = knownTimeZone(store.timezone);
    const period = month ?? localDate(new Date(), timeZone).slice(0, 7);
    const year = Number(period.slice(0, 4));
    const m = Number(period.slice(5, 7));
    const [bounds] = await tx.$queryRaw<{ from: Date; to: Date }[]>`
      SELECT (make_timestamp(${year}::int, ${m}::int, 1, 0, 0, 0) AT TIME ZONE ${timeZone}) AS "from",
             ((make_timestamp(${year}::int, ${m}::int, 1, 0, 0, 0) + interval '1 month') AT TIME ZONE ${timeZone}) AS "to"`;
    if (!bounds) throw new Error('Could not compute the month bounds.');
    return {
      month: period,
      timeZone,
      registration: parseRegistration(store.gstRegistration),
      // A calendar month lies inside one financial year, which narrows the index range.
      where: {
        storeId,
        financialYear: financialYearOf(year, m),
        issuedAt: { gte: bounds.from, lt: bounds.to },
      },
    };
  }

  /** GSTR-1 tables for a calendar month in the store's time zone (default: this month). */
  gstr1(storeId: string, month?: string): Promise<Gstr1Report> {
    return this.tenantDb.run(storeId, async (tx) => {
      const { where, ...p } = await this.period(tx, storeId, month);
      const [invoices, creditNotes] = await Promise.all([
        tx.orderInvoice.findMany({
          where,
          select: { number: true, issuedAt: true, data: true },
        }),
        tx.creditNote.findMany({
          where,
          select: {
            number: true,
            issuedAt: true,
            cancelledAt: true,
            data: true,
            order: {
              select: { invoice: { select: { number: true, issuedAt: true, data: true } } },
            },
          },
        }),
      ]);
      const report = buildGstr1({
        ...p,
        invoices,
        creditNotes: creditNotes.map(({ order, cancelledAt, ...n }) => ({
          ...n,
          invoice: order.invoice,
          cancelled: cancelledAt !== null,
        })),
      });
      await this.addItc(tx, storeId, p.month, report);
      return report;
    });
  }

  /** Fills GSTR-3B table 4 from purchase orders whose supplier invoice is dated in the month. */
  private async addItc(tx: TenantTx, storeId: string, month: string, report: Gstr1Report) {
    const from = new Date(`${month}-01T00:00:00Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    const rows = await tx.purchaseOrder.findMany({
      where: {
        storeId,
        status: { in: ['PARTIALLY_RECEIVED', 'RECEIVED'] },
        supplierInvoiceDate: { gte: from, lt: to },
      },
      select: {
        id: true,
        number: true,
        supplierReference: true,
        supplierInvoiceDate: true,
        shippingCost: true,
        shippingTaxRateBps: true,
        reverseCharge: true,
        supplier: { select: { name: true, gstin: true } },
        lines: { select: { receivedQuantity: true, unitCost: true, taxRateBps: true } },
      },
    });
    const { itc, inwardReverseCharge, warnings } = buildItc(
      report.gstin,
      rows.map((r) => ({
        id: r.id,
        number: r.number,
        supplierName: r.supplier.name,
        supplierGstin: r.supplier.gstin,
        supplierReference: r.supplierReference,
        invoiceDate: r.supplierInvoiceDate?.toISOString().slice(0, 10) ?? '',
        shippingCost: r.shippingCost,
        shippingTaxRateBps: r.shippingTaxRateBps,
        reverseCharge: r.reverseCharge,
        lines: r.lines,
      })),
    );
    // Received with GST but no invoice date: easy to miss, so say so.
    const undated = await tx.purchaseOrder.count({
      where: {
        storeId,
        status: { in: ['PARTIALLY_RECEIVED', 'RECEIVED'] },
        supplierInvoiceDate: null,
        OR: [{ shippingTaxRateBps: { gt: 0 } }, { lines: { some: { taxRateBps: { gt: 0 } } } }],
      },
    });
    if (report.gstin && undated > 0) {
      warnings.push(
        `${undated} received purchase order${undated === 1 ? ' with GST has' : 's with GST have'} no supplier invoice date, so ${undated === 1 ? 'it is' : 'they are'} not in any month's input tax credit. Add the date on the purchase order.`,
      );
    }
    report.gstr3b.itc = itc;
    report.gstr3b.inwardReverseCharge = inwardReverseCharge;
    if (itc.purchases.length > 0) {
      warnings.push(
        'Table 4(B) reversals are not worked out here: reverse credit for supplier bills unpaid after 180 days, and for goods used for exempt supplies or personally.',
      );
    }
    report.warnings.push(...warnings);
  }

  /**
   * The month's invoices, then its credit notes, in number order, a page at a time: for printing
   * or saving them all as PDF.
   */
  documents(storeId: string, month: string | undefined, page: number): Promise<GstDocuments> {
    return this.tenantDb.run(storeId, async (tx) => {
      const { where, month: period } = await this.period(tx, storeId, month);
      const [invoiceCount, noteCount] = await Promise.all([
        tx.orderInvoice.count({ where }),
        tx.creditNote.count({ where }),
      ]);
      const total = invoiceCount + noteCount;
      const pageCount = Math.max(1, Math.ceil(total / GST_DOCUMENTS_PAGE_SIZE));
      const start = (Math.min(page, pageCount) - 1) * GST_DOCUMENTS_PAGE_SIZE;
      const invoiceTake = Math.max(0, Math.min(GST_DOCUMENTS_PAGE_SIZE, invoiceCount - start));
      const noteSkip = Math.max(0, start - invoiceCount);
      const noteTake = GST_DOCUMENTS_PAGE_SIZE - invoiceTake;
      const order = [{ sequence: 'asc' as const }];
      const [invoices, notes] = await Promise.all([
        invoiceTake > 0
          ? tx.orderInvoice.findMany({ where, orderBy: order, skip: start, take: invoiceTake })
          : [],
        noteTake > 0
          ? tx.creditNote.findMany({ where, orderBy: order, skip: noteSkip, take: noteTake })
          : [],
      ]);
      return {
        month: period,
        page: Math.min(page, pageCount),
        pageCount,
        invoiceCount,
        creditNoteCount: noteCount,
        invoices: invoices.map((i) => ({
          id: i.id,
          number: i.number,
          financialYear: i.financialYear,
          issuedAt: i.issuedAt.toISOString(),
          data: taxInvoiceDataSchema.parse(i.data),
          creditNotes: [],
        })),
        creditNotes: notes.map((n) => ({
          id: n.id,
          number: n.number,
          issuedAt: n.issuedAt.toISOString(),
          cancelledAt: n.cancelledAt?.toISOString() ?? null,
          data: creditNoteDataSchema.parse(n.data),
        })),
      };
    });
  }
}

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/gst-returns')
export class GstReturnsController {
  constructor(private readonly returns: GstReturnsService) {}

  /** The month's invoices and credit notes in GSTR-1 tables. */
  @Get('gstr1')
  @RequirePermission('orders:read')
  gstr1(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(querySchema)) query: z.infer<typeof querySchema>,
  ): Promise<Gstr1Report> {
    return this.returns.gstr1(store.id, query.month);
  }

  /** The month's invoices and credit notes in full, a page at a time (for printing). */
  @Get('documents')
  @RequirePermission('orders:read')
  documents(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(documentsQuerySchema)) query: z.infer<typeof documentsQuerySchema>,
  ): Promise<GstDocuments> {
    return this.returns.documents(store.id, query.month, query.page);
  }
}
