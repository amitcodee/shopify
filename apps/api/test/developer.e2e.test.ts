import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { WEBHOOK_HEADERS } from '@repo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebhooksService } from '../src/webhooks/webhooks.service.js';
import {
  createTestApp,
  merchantWithStore,
  payMock,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

interface Received {
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

describe('Developer platform: access tokens and webhooks', () => {
  let ctx: TestContext;
  let webhooks: WebhooksService;
  let server: Server;
  let receiverUrl: string;
  const received: Received[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    webhooks = (ctx.app as INestApplication).get(WebhooksService);
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        received.push({ path: req.url ?? '', headers: req.headers, body });
        res.writeHead(req.url?.startsWith('/fail') ? 500 : 200).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    receiverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await ctx?.close();
  });

  it('scopes access tokens to their store and permissions', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const created = await ctx
      .http()
      .post(`${admin}/api-tokens`)
      .set(m.auth)
      .send({ name: 'Inventory sync', permissions: ['products:read', 'products:write'] })
      .expect(201);
    expect(created.body.token).toMatch(/^cpat_/);
    const bearer = { Authorization: `Bearer ${created.body.token}` };

    await ctx.http().get(`${admin}/products`).set(bearer).expect(200);
    await ctx
      .http()
      .post(`${admin}/products`)
      .set(bearer)
      .send({ title: 'Via API', variants: [{ price: 100 }] })
      .expect(201);
    await ctx.http().get(`${admin}/orders`).set(bearer).expect(403); // not granted
    await ctx.http().get('/api/v1/auth/me').set(bearer).expect(403); // not the creator's session
    await ctx.http().get(`${admin}/api-tokens`).set(bearer).expect(403); // cannot manage tokens

    const other = await merchantWithStore(ctx);
    await ctx.http().get(`/api/v1/admin/stores/${other.store.id}/products`).set(bearer).expect(403);

    const listed = await ctx.http().get(`${admin}/api-tokens`).set(m.auth).expect(200);
    expect(listed.body[0]).toMatchObject({
      name: 'Inventory sync',
      prefix: created.body.token.slice(0, 12),
    });
    expect(listed.body[0].lastUsedAt).not.toBeNull();
    expect(JSON.stringify(listed.body)).not.toContain(created.body.token);

    await ctx.http().delete(`${admin}/api-tokens/${created.body.id}`).set(m.auth).expect(204);
    await ctx.http().get(`${admin}/products`).set(bearer).expect(401);
    await ctx
      .http()
      .get(`${admin}/products`)
      .set({ Authorization: 'Bearer cpat_forged' })
      .expect(401);
  });

  it('caps token permissions at the creator’s role', async () => {
    const owner = await merchantWithStore(ctx);
    const staff = await merchantWithStore(ctx);
    await ctx.platform.storeMember.create({
      data: {
        storeId: owner.store.id,
        userId: staff.session.user.id,
        role: 'STAFF',
        permissions: ['settings:read', 'settings:write', 'products:read'],
      },
    });
    const admin = `/api/v1/admin/stores/${owner.store.id}`;
    await ctx
      .http()
      .post(`${admin}/api-tokens`)
      .set(staff.auth)
      .send({ name: 'Too much', permissions: ['orders:read'] })
      .expect(403);
    const token = await ctx
      .http()
      .post(`${admin}/api-tokens`)
      .set(staff.auth)
      .send({ name: 'Catalog', permissions: ['products:read'] })
      .expect(201);
    await ctx
      .http()
      .get(`${admin}/products`)
      .set({ Authorization: `Bearer ${token.body.token}` })
      .expect(200);
    // The creator loses access: the token stops working with them.
    await ctx.platform.storeMember.update({
      where: { storeId_userId: { storeId: owner.store.id, userId: staff.session.user.id } },
      data: { permissions: ['settings:read', 'settings:write'] },
    });
    await ctx
      .http()
      .get(`${admin}/products`)
      .set({ Authorization: `Bearer ${token.body.token}` })
      .expect(403);
  });

  it('delivers signed webhooks for subscribed events and retries failures', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const subscribe = (topic: string, path: string) =>
      ctx
        .http()
        .post(`${admin}/webhooks`)
        .set(m.auth)
        .send({ topic, url: `${receiverUrl}${path}` })
        .expect(201)
        .then((r) => r.body as { id: string; secret: string });
    const products = await subscribe('products/created', '/products');
    const paid = await subscribe('orders/paid', '/orders');
    const failing = await subscribe('products/created', '/fail');
    await ctx
      .http()
      .post(`${admin}/webhooks`)
      .set(m.auth)
      .send({ topic: 'orders/exploded', url: receiverUrl })
      .expect(400);

    const product = await ctx
      .http()
      .post(`${admin}/products`)
      .set(m.auth)
      .send({ title: 'Lamp', status: 'ACTIVE', variants: [{ price: 2500, inventoryQuantity: 5 }] })
      .expect(201);
    received.length = 0;
    expect(await webhooks.deliverDue()).toBe(2);
    expect(await webhooks.deliverDue()).toBe(0); // the failure is not due again yet

    const hook = received.find((r) => r.path === '/products');
    expect(hook?.headers[WEBHOOK_HEADERS.topic]).toBe('products/created');
    expect(hook?.headers[WEBHOOK_HEADERS.storeId]).toBe(m.store.id);
    const expected = createHmac('sha256', products.secret)
      .update(hook?.body ?? '')
      .digest('base64');
    expect(hook?.headers[WEBHOOK_HEADERS.signature]).toBe(expected);
    expect(JSON.parse(hook?.body ?? '{}')).toMatchObject({ id: product.body.id, title: 'Lamp' });

    const failed = await ctx
      .http()
      .get(`${admin}/webhooks/${failing.id}/deliveries`)
      .set(m.auth)
      .expect(200);
    expect(failed.body[0]).toMatchObject({ status: 'PENDING', attempts: 1, lastStatusCode: 500 });
    const list = await ctx.http().get(`${admin}/webhooks`).set(m.auth).expect(200);
    expect(list.body.find((w: { id: string }) => w.id === failing.id).failureCount).toBe(1);

    // A paid order notifies orders/paid subscribers.
    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    const cart = (await sf('post', '/cart').expect(201)).body.token as string;
    await sf('post', '/cart/lines', { cart })
      .send({ variantId: product.body.variants[0].id })
      .expect(201);
    const placed = await sf('post', '/checkout', { cart })
      .send({
        email: 'ada@example.com',
        shippingAddress: {
          name: 'Ada',
          line1: '1 Way',
          city: 'London',
          postalCode: 'N1',
          country: 'GB',
        },
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    await payMock(sf, placed.body.paymentUrl);
    received.length = 0;
    await webhooks.deliverDue();
    const order = received.find((r) => r.path === '/orders');
    expect(JSON.parse(order?.body ?? '{}')).toMatchObject({
      number: placed.body.orderNumber,
      financialStatus: 'PAID',
      total: 2500,
    });
    expect(order?.headers[WEBHOOK_HEADERS.signature]).toBe(
      createHmac('sha256', paid.secret)
        .update(order?.body ?? '')
        .digest('base64'),
    );

    // Other stores cannot see or delete this store's webhooks.
    const other = await merchantWithStore(ctx);
    await ctx
      .http()
      .delete(`/api/v1/admin/stores/${other.store.id}/webhooks/${paid.id}`)
      .set(other.auth)
      .expect(404);
  });
});
