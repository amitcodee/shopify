import { z } from 'zod';
import { toCsv } from './csv.js';
import { minorToDecimalString } from './money.js';

/**
 * A month of GST invoices and credit notes, sorted into the tables of the GSTR-1 return. Built
 * only from documents already issued, so it always matches what was printed.
 */

const placeSchema = z.object({ code: z.string().nullable(), name: z.string() });
const taxSchema = { igst: z.number().int(), cgst: z.number().int(), sgst: z.number().int() };

export const gstr1Schema = z.object({
  /** "2026-11". */
  month: z.string(),
  gstin: z.string().nullable(),
  legalName: z.string().nullable(),
  /** Currency of the documents (GST returns are filed in rupees). */
  currency: z.string(),
  /** 4A: invoices to registered businesses, one row per invoice and rate. */
  b2b: z.array(
    z.object({
      gstin: z.string(),
      name: z.string(),
      invoiceNumber: z.string(),
      /** YYYY-MM-DD in the store's time zone. */
      invoiceDate: z.string(),
      invoiceValue: z.number().int(),
      placeOfSupply: placeSchema,
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      ...taxSchema,
    }),
  ),
  /** 5: other-state consumer invoices above the B2CL limit (Rs 1 lakh), per invoice and rate. */
  b2cl: z.array(
    z.object({
      invoiceNumber: z.string(),
      invoiceDate: z.string(),
      invoiceValue: z.number().int(),
      placeOfSupply: placeSchema,
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      igst: z.number().int(),
    }),
  ),
  /** 6A: deliveries outside India. WPAY when IGST was charged, WOPAY otherwise. */
  exports: z.array(
    z.object({
      exportType: z.enum(['WPAY', 'WOPAY']),
      invoiceNumber: z.string(),
      invoiceDate: z.string(),
      invoiceValue: z.number().int(),
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      igst: z.number().int(),
    }),
  ),
  /** 7: all other consumer sales, totalled by place of supply and rate, less their credit notes. */
  b2cs: z.array(
    z.object({
      supplyType: z.enum(['intra', 'inter']),
      placeOfSupply: placeSchema,
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      ...taxSchema,
    }),
  ),
  /** 9B: credit notes to registered businesses. */
  cdnr: z.array(
    z.object({
      gstin: z.string(),
      name: z.string(),
      noteNumber: z.string(),
      noteDate: z.string(),
      invoiceNumber: z.string(),
      placeOfSupply: placeSchema,
      noteValue: z.number().int(),
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      ...taxSchema,
    }),
  ),
  /** 9B: credit notes against B2CL and export invoices. */
  cdnur: z.array(
    z.object({
      urType: z.enum(['B2CL', 'EXPWP', 'EXPWOP']),
      noteNumber: z.string(),
      noteDate: z.string(),
      invoiceNumber: z.string(),
      placeOfSupply: placeSchema,
      noteValue: z.number().int(),
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      igst: z.number().int(),
    }),
  ),
  /** 12: by HSN/SAC and rate, split into sales to businesses and to consumers, less credit notes. */
  hsn: z.array(
    z.object({
      audience: z.enum(['b2b', 'b2c']),
      hsCode: z.string().nullable(),
      description: z.string(),
      /** NOS for goods, NA for services (SAC codes 99…). */
      uqc: z.string(),
      quantity: z.number().int(),
      /** Taxable value plus tax. */
      totalValue: z.number().int(),
      rateBps: z.number().int(),
      taxableValue: z.number().int(),
      ...taxSchema,
    }),
  ),
  /** 13: number ranges issued this month, per series. */
  documents: z.array(
    z.object({
      nature: z.enum(['invoice', 'credit_note']),
      from: z.string(),
      to: z.string(),
      total: z.number().int(),
      cancelled: z.number().int(),
    }),
  ),
  totals: z.object({
    invoices: z.number().int(),
    creditNotes: z.number().int(),
    /** Invoices less credit notes. */
    taxableValue: z.number().int(),
    ...taxSchema,
  }),
  /** Things to fix or check before filing. */
  warnings: z.array(z.string()),
});
export type Gstr1Report = z.infer<typeof gstr1Schema>;

export const GSTR1_SECTIONS = [
  { key: 'b2b', label: 'B2B invoices', table: '4A' },
  { key: 'b2cl', label: 'B2C large', table: '5' },
  { key: 'b2cs', label: 'B2C small', table: '7' },
  { key: 'exp', label: 'Exports', table: '6A' },
  { key: 'cdnr', label: 'Credit notes (registered)', table: '9B' },
  { key: 'cdnur', label: 'Credit notes (unregistered)', table: '9B' },
  { key: 'hsn_b2b', label: 'HSN summary (B2B)', table: '12' },
  { key: 'hsn_b2c', label: 'HSN summary (B2C)', table: '12' },
  { key: 'docs', label: 'Documents issued', table: '13' },
] as const;
export type Gstr1Section = (typeof GSTR1_SECTIONS)[number]['key'];

/** "2026-11" that is a real month. */
export const gstMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM')
  .refine((v) => Number(v.slice(0, 4)) >= 2017, 'GST began in July 2017');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-19" -> "19-Nov-2026", the date format of the GST Offline Tool. */
export function gstDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${MONTHS[Number(m) - 1] ?? m}-${y}`;
}

/** "27-Maharashtra"; blank when the place is not an Indian state. */
export function gstPlace(place: { code: string | null; name: string }): string {
  return place.code ? `${place.code}-${place.name}` : '';
}

/**
 * One GSTR-1 table as CSV, with the column headings of the GST Offline Tool's CSV templates
 * (amounts in rupees with two decimals). E-commerce GSTIN stays blank: sales on your own store
 * do not go through an e-commerce operator.
 */
export function gstr1Csv(report: Gstr1Report, section: Gstr1Section): string {
  const money = (minor: number) => minorToDecimalString(minor, report.currency);
  const rate = (bps: number) => String(bps / 100);
  switch (section) {
    case 'b2b':
      return toCsv([
        [
          'GSTIN/UIN of Recipient',
          'Receiver Name',
          'Invoice Number',
          'Invoice date',
          'Invoice Value',
          'Place Of Supply',
          'Reverse Charge',
          'Applicable % of Tax Rate',
          'Invoice Type',
          'E-Commerce GSTIN',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        ...report.b2b.map((r) => [
          r.gstin,
          r.name,
          r.invoiceNumber,
          gstDate(r.invoiceDate),
          money(r.invoiceValue),
          gstPlace(r.placeOfSupply),
          'N',
          '',
          'Regular B2B',
          '',
          rate(r.rateBps),
          money(r.taxableValue),
          money(0),
        ]),
      ]);
    case 'b2cl':
      return toCsv([
        [
          'Invoice Number',
          'Invoice date',
          'Invoice Value',
          'Place Of Supply',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
          'E-Commerce GSTIN',
        ],
        ...report.b2cl.map((r) => [
          r.invoiceNumber,
          gstDate(r.invoiceDate),
          money(r.invoiceValue),
          gstPlace(r.placeOfSupply),
          '',
          rate(r.rateBps),
          money(r.taxableValue),
          money(0),
          '',
        ]),
      ]);
    case 'b2cs':
      return toCsv([
        [
          'Type',
          'Place Of Supply',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
          'E-Commerce GSTIN',
        ],
        ...report.b2cs.map((r) => [
          'OE',
          gstPlace(r.placeOfSupply),
          '',
          rate(r.rateBps),
          money(r.taxableValue),
          money(0),
          '',
        ]),
      ]);
    case 'exp':
      return toCsv([
        [
          'Export Type',
          'Invoice Number',
          'Invoice date',
          'Invoice Value',
          'Port Code',
          'Shipping Bill Number',
          'Shipping Bill Date',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        ...report.exports.map((r) => [
          r.exportType,
          r.invoiceNumber,
          gstDate(r.invoiceDate),
          money(r.invoiceValue),
          '',
          '',
          '',
          rate(r.rateBps),
          money(r.taxableValue),
          money(0),
        ]),
      ]);
    case 'cdnr':
      return toCsv([
        [
          'GSTIN/UIN of Recipient',
          'Receiver Name',
          'Note Number',
          'Note Date',
          'Note Type',
          'Place Of Supply',
          'Reverse Charge',
          'Note Supply Type',
          'Note Value',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        ...report.cdnr.map((r) => [
          r.gstin,
          r.name,
          r.noteNumber,
          gstDate(r.noteDate),
          'C',
          gstPlace(r.placeOfSupply),
          'N',
          'Regular B2B',
          money(r.noteValue),
          '',
          rate(r.rateBps),
          money(r.taxableValue),
          money(0),
        ]),
      ]);
    case 'cdnur':
      return toCsv([
        [
          'UR Type',
          'Note Number',
          'Note Date',
          'Note Type',
          'Place Of Supply',
          'Note Value',
          'Applicable % of Tax Rate',
          'Rate',
          'Taxable Value',
          'Cess Amount',
        ],
        ...report.cdnur.map((r) => [
          r.urType,
          r.noteNumber,
          gstDate(r.noteDate),
          'C',
          gstPlace(r.placeOfSupply),
          money(r.noteValue),
          '',
          rate(r.rateBps),
          money(r.taxableValue),
          money(0),
        ]),
      ]);
    case 'hsn_b2b':
    case 'hsn_b2c':
      return toCsv([
        [
          'HSN',
          'Description',
          'UQC',
          'Total Quantity',
          'Total Value',
          'Rate',
          'Taxable Value',
          'Integrated Tax Amount',
          'Central Tax Amount',
          'State/UT Tax Amount',
          'Cess Amount',
        ],
        ...report.hsn
          .filter((r) => r.audience === (section === 'hsn_b2b' ? 'b2b' : 'b2c'))
          .map((r) => [
            r.hsCode ?? '',
            r.description,
            r.uqc,
            r.quantity,
            money(r.totalValue),
            rate(r.rateBps),
            money(r.taxableValue),
            money(r.igst),
            money(r.cgst),
            money(r.sgst),
            money(0),
          ]),
      ]);
    case 'docs':
      return toCsv([
        ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'],
        ...report.documents.map((d) => [
          d.nature === 'invoice' ? 'Invoices for outward supply' : 'Credit Note',
          d.from,
          d.to,
          d.total,
          d.cancelled,
        ]),
      ]);
  }
}
