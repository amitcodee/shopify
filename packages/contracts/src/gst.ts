import { z } from 'zod';

/**
 * India GST: the store's registration, Indian states with their GST codes, and the tax invoice
 * printed for an order (ADR 0015).
 */

/** States and union territories by GST state code, with the codes shoppers may type. */
export const GST_STATES: readonly { code: string; name: string; aliases: readonly string[] }[] = [
  { code: '01', name: 'Jammu and Kashmir', aliases: ['JK'] },
  { code: '02', name: 'Himachal Pradesh', aliases: ['HP'] },
  { code: '03', name: 'Punjab', aliases: ['PB'] },
  { code: '04', name: 'Chandigarh', aliases: ['CH'] },
  { code: '05', name: 'Uttarakhand', aliases: ['UK', 'UT', 'UA', 'UTTARANCHAL'] },
  { code: '06', name: 'Haryana', aliases: ['HR'] },
  { code: '07', name: 'Delhi', aliases: ['DL', 'NEW DELHI', 'NCT OF DELHI'] },
  { code: '08', name: 'Rajasthan', aliases: ['RJ'] },
  { code: '09', name: 'Uttar Pradesh', aliases: ['UP'] },
  { code: '10', name: 'Bihar', aliases: ['BR', 'BH'] },
  { code: '11', name: 'Sikkim', aliases: ['SK'] },
  { code: '12', name: 'Arunachal Pradesh', aliases: ['AR'] },
  { code: '13', name: 'Nagaland', aliases: ['NL'] },
  { code: '14', name: 'Manipur', aliases: ['MN'] },
  { code: '15', name: 'Mizoram', aliases: ['MZ'] },
  { code: '16', name: 'Tripura', aliases: ['TR'] },
  { code: '17', name: 'Meghalaya', aliases: ['ML'] },
  { code: '18', name: 'Assam', aliases: ['AS'] },
  { code: '19', name: 'West Bengal', aliases: ['WB'] },
  { code: '20', name: 'Jharkhand', aliases: ['JH'] },
  { code: '21', name: 'Odisha', aliases: ['OD', 'OR', 'ORISSA'] },
  { code: '22', name: 'Chhattisgarh', aliases: ['CG', 'CT'] },
  { code: '23', name: 'Madhya Pradesh', aliases: ['MP'] },
  { code: '24', name: 'Gujarat', aliases: ['GJ'] },
  {
    code: '26',
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    aliases: ['DH', 'DN', 'DD', 'DAMAN AND DIU', 'DADRA AND NAGAR HAVELI'],
  },
  { code: '27', name: 'Maharashtra', aliases: ['MH'] },
  { code: '29', name: 'Karnataka', aliases: ['KA'] },
  { code: '30', name: 'Goa', aliases: ['GA'] },
  { code: '31', name: 'Lakshadweep', aliases: ['LD'] },
  { code: '32', name: 'Kerala', aliases: ['KL'] },
  { code: '33', name: 'Tamil Nadu', aliases: ['TN'] },
  { code: '34', name: 'Puducherry', aliases: ['PY', 'PONDICHERRY'] },
  { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['AN'] },
  { code: '36', name: 'Telangana', aliases: ['TG', 'TS'] },
  { code: '37', name: 'Andhra Pradesh', aliases: ['AP'] },
  { code: '38', name: 'Ladakh', aliases: ['LA'] },
];

const squash = (value: string) =>
  value
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** The GST state a shopper's region ("MH", "IN-MH", "Maharashtra", "27") refers to, if any. */
export function gstStateFor(region: string | null | undefined): (typeof GST_STATES)[number] | null {
  if (!region) return null;
  const key = squash(region).replace(/^IN /, '');
  if (!key) return null;
  return (
    GST_STATES.find(
      (s) => s.code === key || squash(s.name) === key || s.aliases.some((a) => squash(a) === key),
    ) ?? null
  );
}

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** True when the 15th character is the GSTIN check digit of the first 14. */
export function gstinChecksumValid(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARS.indexOf(gstin[i] ?? '');
    if (value < 0) return false;
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === gstin[14];
}

export const gstinSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/\s/g, ''))
  .pipe(
    z
      .string()
      .regex(
        /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][A-Z0-9][0-9A-Z]$/,
        'A GSTIN has 15 characters, like 27ABCDE1234F1Z5',
      )
      .refine((v) => GST_STATES.some((s) => s.code === v.slice(0, 2)), {
        message: 'The first two digits of a GSTIN are a state code',
      })
      .refine(gstinChecksumValid, { message: 'This GSTIN’s last character does not match' }),
  );

export const gstRegistrationInputSchema = z.strictObject({
  gstin: gstinSchema,
  /** Legal name as registered for GST (may differ from the store name). */
  legalName: z.string().trim().min(2, 'Enter the legal name').max(200),
  /** Principal place of business, as on the GST certificate. */
  address: z.string().trim().min(10, 'Enter the full registered address').max(500),
  /** Printed before the invoice number: letters and digits, up to 5. */
  invoicePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,5}$/, 'Use up to 5 letters or digits')
    .default('INV'),
});
export type GstRegistrationInput = z.input<typeof gstRegistrationInputSchema>;

export const gstRegistrationSchema = z.object({
  gstin: z.string(),
  legalName: z.string(),
  address: z.string(),
  invoicePrefix: z.string(),
  /** From the GSTIN's first two digits. */
  stateCode: z.string(),
  stateName: z.string(),
});
export type GstRegistration = z.infer<typeof gstRegistrationSchema>;

/** GET/PUT /admin/stores/:id/gst: null when the store is not GST-registered. */
export const gstSettingsSchema = z.object({ registration: gstRegistrationSchema.nullable() });
export type GstSettings = z.infer<typeof gstSettingsSchema>;

/** Tax split on one invoice row: CGST + SGST inside the seller's state, IGST otherwise. */
const taxSplitSchema = z.object({
  rateBps: z.number().int(),
  cgst: z.number().int(),
  sgst: z.number().int(),
  igst: z.number().int(),
});

export const taxInvoiceLineSchema = taxSplitSchema.extend({
  description: z.string(),
  sku: z.string().nullable(),
  hsCode: z.string().nullable(),
  quantity: z.number().int(),
  unitPrice: z.number().int(),
  discount: z.number().int(),
  /** Quantity x unit price, less discount (minor units). */
  taxableValue: z.number().int(),
  /** Taxable value plus tax. */
  total: z.number().int(),
});
export type TaxInvoiceLine = z.infer<typeof taxInvoiceLineSchema>;

export const taxInvoiceDataSchema = z.object({
  seller: z.object({
    storeName: z.string(),
    legalName: z.string(),
    gstin: z.string(),
    address: z.string(),
    stateCode: z.string(),
    stateName: z.string(),
    email: z.string(),
  }),
  buyer: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    address: z.array(z.string()),
    /** Registered business buyer (B2B invoice); null for consumers. */
    gstin: z.string().nullable().default(null),
    legalName: z.string().nullable().default(null),
  }),
  /** Where the goods are delivered; null code when the region is not an Indian state. */
  placeOfSupply: z.object({ code: z.string().nullable(), name: z.string() }),
  /** intra: CGST + SGST. inter: IGST. export: delivered outside India (zero-rated). */
  supplyType: z.enum(['intra', 'inter', 'export']),
  orderNumber: z.number().int(),
  orderDate: z.iso.datetime(),
  currency: z.string(),
  lines: z.array(taxInvoiceLineSchema),
  /** Shipping as its own row; null when free or not charged. */
  shipping: taxSplitSchema
    .extend({ description: z.string(), taxableValue: z.number().int() })
    .nullable(),
  /** Per rate (and HSN), as GST returns report it. */
  summary: z.array(
    taxSplitSchema.extend({ hsCode: z.string().nullable(), taxableValue: z.number().int() }),
  ),
  taxableTotal: z.number().int(),
  cgstTotal: z.number().int(),
  sgstTotal: z.number().int(),
  igstTotal: z.number().int(),
  /** Order total (equals taxable total plus all tax). */
  total: z.number().int(),
  /** Paid by gift card (not a discount: GST was charged on it). */
  giftCardAmount: z.number().int(),
  amountInWords: z.string(),
  paymentMethod: z.string(),
  paid: z.boolean(),
});
export type TaxInvoiceData = z.infer<typeof taxInvoiceDataSchema>;

export const creditNoteDataSchema = z.object({
  invoiceNumber: z.string(),
  invoiceDate: z.iso.datetime(),
  seller: taxInvoiceDataSchema.shape.seller,
  buyer: taxInvoiceDataSchema.shape.buyer,
  placeOfSupply: taxInvoiceDataSchema.shape.placeOfSupply,
  supplyType: taxInvoiceDataSchema.shape.supplyType,
  orderNumber: z.number().int(),
  currency: z.string(),
  reason: z.string().nullable(),
  /** The refund split over the invoice's HSN/rate rows by their value. */
  rows: taxInvoiceDataSchema.shape.summary,
  taxableTotal: z.number().int(),
  cgstTotal: z.number().int(),
  sgstTotal: z.number().int(),
  igstTotal: z.number().int(),
  /** The amount refunded (taxable value plus tax). */
  total: z.number().int(),
  amountInWords: z.string(),
});
export type CreditNoteData = z.infer<typeof creditNoteDataSchema>;

export const creditNoteSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  issuedAt: z.iso.datetime(),
  /** The refund it records failed later; the note no longer counts. */
  cancelledAt: z.iso.datetime().nullable(),
  data: creditNoteDataSchema,
});
export type CreditNote = z.infer<typeof creditNoteSchema>;

export const orderInvoiceSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  financialYear: z.string(),
  issuedAt: z.iso.datetime(),
  data: taxInvoiceDataSchema,
  /** Credit notes issued for refunds on this order, oldest first. */
  creditNotes: z.array(creditNoteSchema),
});
export type OrderInvoice = z.infer<typeof orderInvoiceSchema>;

/**
 * GET /admin/stores/:id/orders/:orderId/invoice: the invoice if issued, and whether one can be
 * issued now (and if not, why).
 */
export const orderInvoiceStateSchema = z.object({
  invoice: orderInvoiceSchema.nullable(),
  canIssue: z.boolean(),
  reason: z.string().nullable(),
});
export type OrderInvoiceState = z.infer<typeof orderInvoiceStateSchema>;

/** Indian financial year (April to March) of a calendar date: "2026-27". */
export function financialYearOf(year: number, month: number): string {
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Credit notes have their own series: "CN/26-27/0001". */
export const CREDIT_NOTE_PREFIX = 'CN';

/** "INV/26-27/0001": at most 16 characters for prefixes of up to 5. */
export function invoiceNumber(prefix: string, financialYear: string, sequence: number): string {
  const [start, end] = financialYear.split('-');
  return `${prefix}/${(start ?? '').slice(2)}-${end ?? ''}/${String(sequence).padStart(4, '0')}`;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const ones = n % 10;
  return `${TENS[Math.floor(n / 10)]}${ones ? ` ${ONES[ones]}` : ''}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : '']
    .filter(Boolean)
    .join(' ');
}

/** A whole number in the Indian system: 1,25,000 = "One Lakh Twenty Five Thousand". */
export function numberInWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  if (crore) parts.push(`${numberInWords(crore)} Crore`);
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

/** Minor units in words: INR 1234.50 = "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only". */
export function amountInWords(minor: number, currency: string): string {
  const major = Math.floor(minor / 100);
  const fraction = minor % 100;
  if (currency === 'INR') {
    return `Rupees ${numberInWords(major)}${fraction ? ` and ${numberInWords(fraction)} Paise` : ''} Only`;
  }
  return `${currency} ${numberInWords(major)}${fraction ? ` and ${fraction}/100` : ''} Only`;
}
