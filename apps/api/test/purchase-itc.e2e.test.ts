import { gstinChecksumValid } from '@repo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStore, createTestApp, resetDatabase, signup, type TestContext } from './utils.js';

/** A GSTIN with a valid check character for the first 14 characters. */
function gstin(first14: string): string {
  for (const c of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (gstinChecksumValid(first14 + c)) return first14 + c;
  }
  throw new Error('no check character');
}

describe('Input tax credit (GSTR-3B table 4)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('counts GST on received stock from registered suppliers by invoice month', async () => {
    const session = await signup(ctx);
    const store = await createStore(ctx, session.token, { currency: 'INR' });
    const auth = { Authorization: `Bearer ${session.token}` };
    const admin = `/api/v1/admin/stores/${store.id}`;
    const http = () => ctx.http();

    await http()
      .put(`${admin}/gst`)
      .set(auth)
      .send({
        gstin: '27AAPFU0939F1ZV',
        legalName: 'Kurta House Private Limited',
        address: '12 Linking Road, Mumbai 400050',
        invoicePrefix: 'KH',
      })
      .expect(200);

    const variant = (
      await http()
        .post(`${admin}/products`)
        .set(auth)
        .send({ title: 'Cotton kurta', variants: [{ price: 100_000, inventoryQuantity: 0 }] })
        .expect(201)
    ).body.variants[0].id as string;
    const location = (
      (await http().get(`${admin}/locations`).set(auth).expect(200)).body[0] as {
        id: string;
      }
    ).id;

    const supplier = async (name: string, gst: string) =>
      (await http().post(`${admin}/suppliers`).set(auth).send({ name, gstin: gst }).expect(201))
        .body as { id: string; gstin: string };
    await http()
      .post(`${admin}/suppliers`)
      .set(auth)
      .send({ name: 'Bad', gstin: '99ABCDE1234F1Z5' })
      .expect(400);
    const mumbai = await supplier('Mumbai Mills', gstin('27AAACM1234A1Z'));
    const bengaluru = await supplier('Bengaluru Looms', gstin('29AAACB5678B1Z'));
    const local = await supplier('Local Tailor', '');
    expect(mumbai.gstin).toMatch(/^27/);

    async function purchase(
      supplierId: string,
      body: { quantity: number; unitCost: number; taxRateBps: number; receive: number } & Record<
        string,
        unknown
      >,
    ) {
      const { quantity, unitCost, taxRateBps, receive, ...header } = body;
      const created = await http()
        .post(`${admin}/purchase-orders`)
        .set(auth)
        .send({
          supplierId,
          locationId: location,
          lines: [{ variantId: variant, quantity, unitCost, taxRateBps }],
          ...header,
        })
        .expect(201);
      const id = created.body.id as string;
      await http()
        .post(`${admin}/purchase-orders/${id}/actions`)
        .set(auth)
        .send({ action: 'mark_ordered' })
        .expect(200);
      await http()
        .post(`${admin}/purchase-orders/${id}/receive`)
        .set(auth)
        .send({ lines: [{ lineId: created.body.lines[0].id, quantity: receive }] })
        .expect(200);
      return created.body as { id: string; subtotal: number; taxTotal: number; total: number };
    }

    // Same state, 6 of 10 received, 18% on items and shipping.
    const po1 = await purchase(mumbai.id, {
      quantity: 10,
      unitCost: 1000,
      taxRateBps: 1800,
      receive: 6,
      shippingCost: 500,
      shippingTaxRateBps: 1800,
      supplierReference: 'MM/101',
      supplierInvoiceDate: '2026-11-10',
    });
    expect(po1).toMatchObject({ subtotal: 10_000, taxTotal: 1890, total: 12_390 });
    // Other state, all received, 12%.
    await purchase(bengaluru.id, {
      quantity: 4,
      unitCost: 2500,
      taxRateBps: 1200,
      receive: 4,
      supplierReference: 'BL-7',
      supplierInvoiceDate: '2026-11-20',
    });
    // Unregistered supplier: no credit.
    await purchase(local.id, {
      quantity: 1,
      unitCost: 1000,
      taxRateBps: 500,
      receive: 1,
      supplierInvoiceDate: '2026-11-05',
    });
    // No invoice date yet.
    const undated = await purchase(mumbai.id, {
      quantity: 2,
      unitCost: 1000,
      taxRateBps: 500,
      receive: 2,
    });

    const nov = (
      await http().get(`${admin}/gst-returns/gstr1`).query({ month: '2026-11' }).set(auth)
    ).body;
    expect(nov.gstr3b.itc).toMatchObject({ igst: 1200, cgst: 585, sgst: 585 });
    expect(nov.gstr3b.itc.purchases).toEqual([
      expect.objectContaining({
        supplierName: 'Mumbai Mills',
        invoiceNumber: 'MM/101',
        invoiceDate: '2026-11-10',
        taxableValue: 6500,
        igst: 0,
        cgst: 585,
        sgst: 585,
      }),
      expect.objectContaining({
        supplierName: 'Bengaluru Looms',
        invoiceDate: '2026-11-20',
        taxableValue: 10_000,
        igst: 1200,
      }),
    ]);
    expect(nov.warnings.join(' ')).toMatch(/supplier with no GSTIN/);
    expect(nov.warnings.join(' ')).toMatch(/no supplier invoice date/);

    // The invoice arrives later and is recorded on the received order.
    const recorded = await http()
      .put(`${admin}/purchase-orders/${undated.id}/invoice`)
      .set(auth)
      .send({ supplierReference: 'MM/140', supplierInvoiceDate: '2026-12-02' })
      .expect(200);
    expect(recorded.body).toMatchObject({
      supplierReference: 'MM/140',
      supplierInvoiceDate: '2026-12-02',
    });
    const dec = (
      await http().get(`${admin}/gst-returns/gstr1`).query({ month: '2026-12' }).set(auth)
    ).body;
    expect(dec.gstr3b.itc).toMatchObject({ igst: 0, cgst: 50, sgst: 50 });
    const novAgain = (
      await http().get(`${admin}/gst-returns/gstr1`).query({ month: '2026-11' }).set(auth)
    ).body;
    expect(novAgain.warnings.join(' ')).not.toMatch(/no supplier invoice date/);
  });
});
