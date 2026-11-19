import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StoreUrls } from '../src/orders/store-urls.js';
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
  invoicePrefix: 'kh',
};

const inState = {
  name: 'Asha Rao',
  line1: '4 Carter Road',
  city: 'Mumbai',
  region: 'Maharashtra',
  postalCode: '400050',
  country: 'IN',
  phone: '+91 98200 00000',
};
const otherState = { ...inState, city: 'Bengaluru', region: 'KA', postalCode: '560001' };

describe('GST tax invoices', () => {
  let ctx: TestContext;
  let urls: StoreUrls;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    urls = (ctx.app as INestApplication).get(StoreUrls);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function setup() {
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
    // Clothing at 5% GST, a watch at the 18% default.
    const kurta = await product({
      title: 'Cotton kurta',
      taxRateBps: 500,
      variants: [{ price: 99_900, inventoryQuantity: 10, hsCode: '6211' }],
    });
    const watch = await product({
      title: 'Steel watch',
      variants: [{ price: 250_000, inventoryQuantity: 10, hsCode: '9102.11' }],
    });
    await ctx
      .http()
      .put(`${admin}/tax-rates`)
      .set(auth)
      .send({ country: 'IN', name: 'GST', rateBps: 1800 })
      .expect(200);
    return { auth, admin, sf, kurta, watch };
  }

  async function buy(
    sf: ReturnType<typeof storefrontClient>,
    lines: { variantId: string; quantity: number }[],
    address: typeof inState,
  ) {
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    for (const line of lines) await sf('post', '/cart/lines', { cart }).send(line).expect(201);
    const placed = await sf('post', '/checkout', { cart })
      .send({ email: 'asha@example.com', shippingAddress: address, idempotencyKey: randomUUID() })
      .expect(201);
    return placed.body as { orderNumber: number; paymentUrl: string };
  }

  async function orderId(admin: string, auth: Record<string, string>, number: number) {
    const list = await ctx.http().get(`${admin}/orders`).set(auth).expect(200);
    return (list.body.items as { id: string; number: number }[]).find((o) => o.number === number)!
      .id;
  }

  it('validates and stores the GST registration', async () => {
    const { auth, admin } = await setup();
    expect((await ctx.http().get(`${admin}/gst`).set(auth).expect(200)).body).toEqual({
      registration: null,
    });
    await ctx
      .http()
      .put(`${admin}/gst`)
      .set(auth)
      .send({ ...registration, gstin: '27AAPFU0939F1ZA' })
      .expect(400);
    const saved = await ctx.http().put(`${admin}/gst`).set(auth).send(registration).expect(200);
    expect(saved.body.registration).toMatchObject({
      gstin: '27AAPFU0939F1ZV',
      invoicePrefix: 'KH',
      stateCode: '27',
      stateName: 'Maharashtra',
    });
    await ctx.http().delete(`${admin}/gst`).set(auth).expect(200);
    expect(
      (await ctx.http().get(`${admin}/gst`).set(auth).expect(200)).body.registration,
    ).toBeNull();
  });

  it('charges each product its own rate and issues numbered invoices with the right split', async () => {
    const { auth, admin, sf, kurta, watch } = await setup();

    // Without a registration, paid orders get no invoice.
    const before = await buy(sf, [{ variantId: kurta, quantity: 1 }], inState);
    await payMock(sf, before.paymentUrl);
    const beforeId = await orderId(admin, auth, before.orderNumber);
    const none = await ctx.http().get(`${admin}/orders/${beforeId}/invoice`).set(auth).expect(200);
    expect(none.body).toMatchObject({ invoice: null, canIssue: false });
    expect(none.body.reason).toMatch(/GSTIN/);

    await ctx.http().put(`${admin}/gst`).set(auth).send(registration).expect(200);

    // Same state: 2 kurtas at 5% + 1 watch at 18%, CGST + SGST.
    const local = await buy(
      sf,
      [
        { variantId: kurta, quantity: 2 },
        { variantId: watch, quantity: 1 },
      ],
      inState,
    );
    const localId = await orderId(admin, auth, local.orderNumber);
    const unpaid = await ctx.http().get(`${admin}/orders/${localId}/invoice`).set(auth).expect(200);
    expect(unpaid.body.canIssue).toBe(false);
    await payMock(sf, local.paymentUrl);

    const order = await ctx.http().get(`${admin}/orders/${localId}`).set(auth).expect(200);
    // 5% of 1998.00 = 99.90; 18% of 2500.00 = 450.00.
    expect(order.body.taxTotal).toBe(9_990 + 45_000);

    const issued = await ctx.http().get(`${admin}/orders/${localId}/invoice`).set(auth).expect(200);
    const invoice = issued.body.invoice;
    expect(invoice.number).toMatch(/^KH\/\d{2}-\d{2}\/0001$/);
    expect(invoice.data).toMatchObject({
      supplyType: 'intra',
      placeOfSupply: { code: '27', name: 'Maharashtra' },
      seller: { gstin: '27AAPFU0939F1ZV', legalName: registration.legalName },
      taxableTotal: 199_800 + 250_000,
      cgstTotal: 4_995 + 22_500,
      sgstTotal: 4_995 + 22_500,
      igstTotal: 0,
      total: order.body.total,
    });
    expect(invoice.data.lines).toEqual([
      expect.objectContaining({ hsCode: '6211', rateBps: 500, cgst: 4_995, sgst: 4_995 }),
      expect.objectContaining({ hsCode: '910211', rateBps: 1800, cgst: 22_500, sgst: 22_500 }),
    ]);
    expect(invoice.data.amountInWords).toMatch(/^Rupees .* Only$/);
    expect(invoice.data.buyer.address.at(-1)).toBe('India');
    expect(invoice.data.paymentMethod).toBe('Online (sandbox test payment)');

    // Shopper copy through the order-status token.
    const shopper = await sf('get', `/orders/${urls.orderAccessToken(localId)}/invoice`).expect(
      200,
    );
    expect(shopper.body.number).toBe(invoice.number);
    await sf('get', `/orders/${urls.orderAccessToken(beforeId)}/invoice`).expect(404);

    // Another state: IGST, next number.
    const remote = await buy(sf, [{ variantId: watch, quantity: 1 }], otherState);
    await payMock(sf, remote.paymentUrl);
    const remoteId = await orderId(admin, auth, remote.orderNumber);
    const second = await ctx
      .http()
      .get(`${admin}/orders/${remoteId}/invoice`)
      .set(auth)
      .expect(200);
    expect(second.body.invoice.number).toMatch(/\/0002$/);
    expect(second.body.invoice.data).toMatchObject({
      supplyType: 'inter',
      placeOfSupply: { code: '29', name: 'Karnataka' },
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 45_000,
    });

    // The order paid before registering can be issued by hand; issuing again is a no-op.
    const manual = await ctx
      .http()
      .post(`${admin}/orders/${beforeId}/invoice`)
      .set(auth)
      .expect(200);
    expect(manual.body.invoice.number).toMatch(/\/0003$/);
    const again = await ctx
      .http()
      .post(`${admin}/orders/${beforeId}/invoice`)
      .set(auth)
      .expect(200);
    expect(again.body.invoice.number).toBe(manual.body.invoice.number);

    // A partial refund gets a credit note against the invoice, split by the invoice's rows.
    await ctx
      .http()
      .post(`${admin}/orders/${localId}/refunds`)
      .set(auth)
      .send({ amount: 118_000, reason: 'Watch strap damaged' })
      .expect(201);
    const refunded = await ctx
      .http()
      .get(`${admin}/orders/${localId}/invoice`)
      .set(auth)
      .expect(200);
    const [note] = refunded.body.invoice.creditNotes;
    expect(note.number).toMatch(/^CN\/\d{2}-\d{2}\/0001$/);
    expect(note.data).toMatchObject({
      invoiceNumber: invoice.number,
      reason: 'Watch strap damaged',
      supplyType: 'intra',
      total: 118_000,
    });
    // Rows add up to the refund, and each row's tax matches its rate.
    expect(note.data.taxableTotal + note.data.cgstTotal + note.data.sgstTotal).toBe(118_000);
    for (const row of note.data.rows) {
      const tax = row.cgst + row.sgst;
      expect(Math.abs(tax - (row.taxableValue * row.rateBps) / 10_000)).toBeLessThanOrEqual(1);
    }
    // Naming the returned item puts the whole refund on its rate: the watch, 18%.
    const detail = await ctx.http().get(`${admin}/orders/${localId}`).set(auth).expect(200);
    const watchLine = (detail.body.lines as { id: string; title: string }[]).find(
      (l) => l.title === 'Steel watch',
    )!;
    await ctx
      .http()
      .post(`${admin}/orders/${localId}/refunds`)
      .set(auth)
      .send({ amount: 59_000, restock: [{ lineId: watchLine.id, quantity: 1 }] })
      .expect(201);
    const withItems = await ctx
      .http()
      .get(`${admin}/orders/${localId}/invoice`)
      .set(auth)
      .expect(200);
    const itemNote = withItems.body.invoice.creditNotes[1];
    expect(itemNote.number).toMatch(/\/0002$/);
    expect(itemNote.data.rows).toEqual([
      expect.objectContaining({ rateBps: 500, taxableValue: 0, cgst: 0, sgst: 0 }),
      expect.objectContaining({ rateBps: 1800, taxableValue: 50_000, cgst: 4_500, sgst: 4_500 }),
    ]);

    const shopperNotes = await sf(
      'get',
      `/orders/${urls.orderAccessToken(localId)}/invoice`,
    ).expect(200);
    expect(shopperNotes.body.creditNotes).toHaveLength(2);

    // Issued invoices keep their snapshot when the registration changes.
    await ctx
      .http()
      .put(`${admin}/gst`)
      .set(auth)
      .send({ ...registration, legalName: 'Renamed Pvt Ltd' })
      .expect(200);
    const kept = await ctx.http().get(`${admin}/orders/${localId}/invoice`).set(auth).expect(200);
    expect(kept.body.invoice.data.seller.legalName).toBe(registration.legalName);
  });

  it('takes GST out of tax-inclusive (MRP) prices and invoices a business buyer', async () => {
    const { auth, admin, sf, kurta, watch } = await setup();
    await ctx.http().put(`${admin}/gst`).set(auth).send(registration).expect(200);
    expect((await ctx.http().get(`${admin}/tax-settings`).set(auth).expect(200)).body).toEqual({
      pricesIncludeTax: false,
    });
    await ctx
      .http()
      .put(`${admin}/tax-settings`)
      .set(auth)
      .send({ pricesIncludeTax: true })
      .expect(200);
    expect((await sf('get', '/shop').expect(200)).body.pricesIncludeTax).toBe(true);

    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart }).send({ variantId: kurta, quantity: 1 }).expect(201);
    await sf('post', '/cart/lines', { cart }).send({ variantId: watch, quantity: 1 }).expect(201);
    const preview = await sf('post', '/checkout/preview', { cart })
      .send({ country: 'IN', region: 'KA' })
      .expect(200);
    // 999.00 at 5% holds 47.57; 2,500.00 at 18% holds 381.36. The total stays the MRP.
    expect(preview.body).toMatchObject({
      subtotal: 349_900,
      taxTotal: 4_757 + 38_136,
      taxesIncluded: true,
      total: 349_900,
    });

    // A bad GSTIN is refused; a valid one goes on the invoice.
    await sf('post', '/checkout', { cart })
      .send({
        email: 'buyer@example.com',
        shippingAddress: otherState,
        buyerGstin: '29AAACB1234C1ZA',
        idempotencyKey: randomUUID(),
      })
      .expect(400);
    const placed = await sf('post', '/checkout', { cart })
      .send({
        email: 'buyer@example.com',
        shippingAddress: otherState,
        buyerGstin: '29aaacb1234c1zb',
        buyerLegalName: 'Bengaluru Retail LLP',
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    await payMock(sf, placed.body.paymentUrl);
    const id = await orderId(admin, auth, placed.body.orderNumber);
    const order = await ctx.http().get(`${admin}/orders/${id}`).set(auth).expect(200);
    expect(order.body).toMatchObject({
      total: 349_900,
      taxTotal: 42_893,
      taxesIncluded: true,
      buyerGstin: '29AAACB1234C1ZB',
      buyerLegalName: 'Bengaluru Retail LLP',
    });

    const { invoice } = (
      await ctx.http().get(`${admin}/orders/${id}/invoice`).set(auth).expect(200)
    ).body;
    expect(invoice.data).toMatchObject({
      supplyType: 'inter',
      buyer: { name: 'Bengaluru Retail LLP', gstin: '29AAACB1234C1ZB' },
      taxableTotal: 349_900 - 42_893,
      igstTotal: 42_893,
      total: 349_900,
    });
    expect(invoice.data.lines).toEqual([
      expect.objectContaining({ taxableValue: 99_900 - 4_757, igst: 4_757, total: 99_900 }),
      expect.objectContaining({ taxableValue: 250_000 - 38_136, igst: 38_136, total: 250_000 }),
    ]);

    // Returning the watch refunds its MRP and credits its tax at 18%.
    const watchLine = (order.body.lines as { id: string; title: string }[]).find(
      (l) => l.title === 'Steel watch',
    )!;
    await ctx
      .http()
      .post(`${admin}/orders/${id}/refunds`)
      .set(auth)
      .send({ amount: 250_000, restock: [{ lineId: watchLine.id, quantity: 1 }] })
      .expect(201);
    const after = await ctx.http().get(`${admin}/orders/${id}/invoice`).set(auth).expect(200);
    const [note] = after.body.invoice.creditNotes;
    expect(note.data.rows).toEqual([
      expect.objectContaining({ rateBps: 500, taxableValue: 0, igst: 0 }),
      expect.objectContaining({ rateBps: 1800, taxableValue: 250_000 - 38_136, igst: 38_136 }),
    ]);
  });
});
