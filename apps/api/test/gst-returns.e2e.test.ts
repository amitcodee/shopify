import { randomUUID } from 'node:crypto';
import { gstr1Csv, gstr1Json } from '@repo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createStore,
  createTestApp,
  payMock,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
} from './utils.js';

const registration = {
  gstin: '27AAPFU0939F1ZV',
  legalName: 'Kurta House Private Limited',
  address: '12 Linking Road, Bandra West, Mumbai 400050',
  invoicePrefix: 'KH',
};

const mumbai = {
  name: 'Asha Rao',
  line1: '4 Carter Road',
  city: 'Mumbai',
  region: 'MH',
  postalCode: '400050',
  country: 'IN',
  phone: '+91 98200 00000',
};
const bengaluru = { ...mumbai, city: 'Bengaluru', region: 'KA', postalCode: '560001' };
const london = {
  name: 'Asha Rao',
  line1: '10 Downing Street',
  city: 'London',
  postalCode: 'SW1A 2AA',
  country: 'GB',
  phone: '+44 20 7946 0000',
};

describe('GST returns (GSTR-1)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('sorts the month into B2B, B2CL, B2CS, export, credit note and HSN tables', async () => {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token, { currency: 'INR' });
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const sf = storefrontClient(ctx, `${store.subdomain}.localhost:3200`);
    const product = (body: object) =>
      ctx
        .http()
        .post(`${admin}/products`)
        .set(auth)
        .send({ status: 'ACTIVE', ...body })
        .expect(201)
        .then((r) => r.body.variants[0].id as string);
    const kurta = await product({
      title: 'Cotton kurta',
      taxRateBps: 500,
      variants: [{ price: 100_000, inventoryQuantity: 20, hsCode: '6211' }],
    });
    const sofa = await product({
      title: 'Teak sofa',
      variants: [{ price: 15_000_000, inventoryQuantity: 5, hsCode: '9401' }],
    });
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(auth)
      .send({ country: 'IN', name: 'GST', rateBps: 1800 })
      .expect(200);
    await ctx.http().put(`${admin}/gst`).set(auth).send(registration).expect(200);

    const empty = await ctx.http().get(`${admin}/gst-returns/gstr1`).set(auth).expect(200);
    expect(empty.body).toMatchObject({ gstin: registration.gstin, b2b: [], b2cs: [], hsn: [] });
    await ctx
      .http()
      .get(`${admin}/gst-returns/gstr1`)
      .query({ month: '2026-13' })
      .set(auth)
      .expect(400);

    async function buy(variantId: string, quantity: number, address: object, extra: object = {}) {
      const cart = (await sf('post', '/cart').expect(201)).body.token as string;
      await sf('post', '/cart/lines', { cart }).send({ variantId, quantity }).expect(201);
      const placed = await sf('post', '/checkout', { cart })
        .send({
          email: 'asha@example.com',
          shippingAddress: address,
          idempotencyKey: randomUUID(),
          ...extra,
        })
        .expect(201);
      await payMock(sf, placed.body.paymentUrl);
      const list = await ctx.http().get(`${admin}/orders`).set(auth).expect(200);
      return (list.body.items as { id: string; number: number }[]).find(
        (o) => o.number === placed.body.orderNumber,
      )!.id;
    }

    // Two consumer sales in Maharashtra (B2CS, intra), one refunded in part.
    const local = await buy(kurta, 2, mumbai);
    await buy(kurta, 1, mumbai);
    // A business buyer in Karnataka (B2B).
    await buy(kurta, 3, bengaluru, {
      buyerGstin: '29AAACB1234C1ZB',
      buyerLegalName: 'Bengaluru Retail LLP',
    });
    // A consumer in Karnataka above Rs 1 lakh (B2CL), and a small one there (B2CS, inter).
    const large = await buy(sofa, 1, bengaluru);
    await buy(kurta, 1, bengaluru);
    // Delivered abroad (export, no Indian rate applies).
    await buy(kurta, 1, london);

    await ctx
      .http()
      .post(`${admin}/orders/${local}/refunds`)
      .set(auth)
      .send({ amount: 105_000, reason: 'Wrong size' })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/orders/${large}/refunds`)
      .set(auth)
      .send({ amount: 1_770_000, reason: 'Scratched' })
      .expect(201);

    const { body: report } = await ctx
      .http()
      .get(`${admin}/gst-returns/gstr1`)
      .set(auth)
      .expect(200);
    expect(report.currency).toBe('INR');
    expect(report.totals).toMatchObject({ invoices: 6, creditNotes: 2 });

    expect(report.b2b).toEqual([
      expect.objectContaining({
        gstin: '29AAACB1234C1ZB',
        name: 'Bengaluru Retail LLP',
        placeOfSupply: { code: '29', name: 'Karnataka' },
        rateBps: 500,
        taxableValue: 300_000,
        igst: 15_000,
        cgst: 0,
        invoiceValue: 315_000,
      }),
    ]);
    expect(report.b2cl).toEqual([
      expect.objectContaining({
        rateBps: 1800,
        taxableValue: 15_000_000,
        igst: 2_700_000,
        invoiceValue: 17_700_000,
        placeOfSupply: { code: '29', name: 'Karnataka' },
      }),
    ]);
    expect(report.exports).toEqual([
      expect.objectContaining({ exportType: 'WOPAY', rateBps: 0, taxableValue: 100_000, igst: 0 }),
    ]);
    // Maharashtra: 3 kurtas (3,000 + 150 CGST/SGST) less the 1,050 credit note (1,000 + 50).
    expect(report.b2cs).toEqual([
      {
        supplyType: 'intra',
        placeOfSupply: { code: '27', name: 'Maharashtra' },
        rateBps: 500,
        taxableValue: 200_000,
        igst: 0,
        cgst: 5_000,
        sgst: 5_000,
      },
      {
        supplyType: 'inter',
        placeOfSupply: { code: '29', name: 'Karnataka' },
        rateBps: 500,
        taxableValue: 100_000,
        igst: 5_000,
        cgst: 0,
        sgst: 0,
      },
    ]);
    expect(report.cdnr).toEqual([]);
    expect(report.cdnur).toEqual([
      expect.objectContaining({
        urType: 'B2CL',
        noteValue: 1_770_000,
        rateBps: 1800,
        taxableValue: 1_500_000,
        igst: 270_000,
      }),
    ]);

    const hsn = (audience: string, hsCode: string, rateBps: number) =>
      report.hsn.find(
        (r: { audience: string; hsCode: string; rateBps: number }) =>
          r.audience === audience && r.hsCode === hsCode && r.rateBps === rateBps,
      );
    expect(hsn('b2b', '6211', 500)).toMatchObject({
      quantity: 3,
      taxableValue: 300_000,
      igst: 15_000,
    });
    // Consumers: 2 + 1 + 1 kurtas in India at 5%, less the credit note; the export is 0%.
    expect(hsn('b2c', '6211', 500)).toMatchObject({
      uqc: 'NOS',
      quantity: 4,
      rateBps: 500,
      taxableValue: 300_000,
      cgst: 5_000,
      sgst: 5_000,
      igst: 5_000,
    });
    expect(hsn('b2c', '6211', 0)).toMatchObject({ quantity: 1, taxableValue: 100_000, igst: 0 });
    expect(hsn('b2c', '9401', 1800)).toMatchObject({ taxableValue: 13_500_000, igst: 2_430_000 });

    expect(report.documents).toEqual([
      {
        nature: 'invoice',
        from: expect.stringMatching(/^KH\/\d\d-\d\d\/0001$/),
        to: expect.stringMatching(/\/0006$/),
        total: 6,
        cancelled: 0,
      },
      {
        nature: 'credit_note',
        from: expect.stringMatching(/^CN\/\d\d-\d\d\/0001$/),
        to: expect.stringMatching(/\/0002$/),
        total: 2,
        cancelled: 0,
      },
    ]);
    // GSTR-3B: domestic rated sales less credit notes; the export is zero-rated; 3.2 is the
    // Karnataka consumer sales (the sofa and one kurta) less the sofa's credit note.
    expect(report.gstr3b).toEqual({
      outwardTaxable: { taxableValue: 14_100_000, igst: 2_450_000, cgst: 5_000, sgst: 5_000 },
      zeroRated: { taxableValue: 100_000, igst: 0, cgst: 0, sgst: 0 },
      nilRated: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0 },
      interStateUnregistered: [
        {
          placeOfSupply: { code: '29', name: 'Karnataka' },
          taxableValue: 13_600_000,
          igst: 2_435_000,
        },
      ],
    });
    // Sandbox payments are flagged.
    expect(report.warnings.join(' ')).toMatch(/test-mode payments/);

    // CSV in the offline tool's layout.
    const b2bCsv = gstr1Csv(report, 'b2b').split('\r\n');
    expect(b2bCsv[0]).toMatch(/^GSTIN\/UIN of Recipient,Receiver Name,Invoice Number,Invoice date/);
    expect(b2bCsv[1]).toMatch(
      /^29AAACB1234C1ZB,Bengaluru Retail LLP,KH\/\d\d-\d\d\/0003,\d\d-[A-Z][a-z]{2}-\d{4},3150\.00,29-Karnataka,N,,Regular B2B,,5,3000\.00,0\.00$/,
    );
    expect(gstr1Csv(report, 'b2cs')).toContain('OE,27-Maharashtra,,5,2000.00,0.00,');

    // Portal JSON (offline tool schema): rupees, dd-mm-yyyy, fp = MMYYYY.
    // Read back as parsed JSON, the way the portal sees it.
    const json = JSON.parse(JSON.stringify(gstr1Json(report)));
    expect(json.gstin).toBe(registration.gstin);
    expect(json.fp).toMatch(/^\d{6}$/);
    expect(json.b2b).toEqual([
      {
        ctin: '29AAACB1234C1ZB',
        inv: [
          expect.objectContaining({
            val: 3150,
            pos: '29',
            rchrg: 'N',
            inv_typ: 'R',
            idt: expect.stringMatching(/^\d\d-\d\d-\d{4}$/),
            itms: [
              {
                num: 501,
                itm_det: { txval: 3000, rt: 5, iamt: 150, camt: 0, samt: 0, csamt: 0 },
              },
            ],
          }),
        ],
      },
    ]);
    expect(json.b2cs).toContainEqual({
      sply_ty: 'INTRA',
      pos: '27',
      typ: 'OE',
      txval: 2000,
      rt: 5,
      camt: 50,
      samt: 50,
      csamt: 0,
    });
    expect(json.b2cl[0]).toMatchObject({ pos: '29', inv: [{ val: 177000 }] });
    expect(json.exp[0]).toMatchObject({ exp_typ: 'WOPAY' });
    expect(json.cdnur[0]).toMatchObject({ typ: 'B2CL', ntty: 'C', val: 17700, pos: '29' });
    expect(json.hsn.hsn_b2b[0]).toMatchObject({ hsn_sc: '6211', uqc: 'NOS', qty: 3, rt: 5 });
    expect(json.doc_issue.doc_det.map((d: { doc_num: number }) => d.doc_num)).toEqual([1, 5]);

    // Another month has nothing.
    const other = await ctx
      .http()
      .get(`${admin}/gst-returns/gstr1`)
      .query({ month: '2020-01' })
      .set(auth)
      .expect(200);
    expect(other.body.totals.invoices).toBe(0);
  });
});
