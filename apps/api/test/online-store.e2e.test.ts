import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

describe('Online store: pages, policies, navigation', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function setup() {
    const merchant = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${merchant.store.id}`;
    const sf = storefrontClient(ctx, `${merchant.store.subdomain}.localhost:3200`);
    return { merchant, admin, sf };
  }

  it('publishes pages by handle and hides drafts from the storefront', async () => {
    const { merchant, admin, sf } = await setup();
    const about = await ctx
      .http()
      .post(`${admin}/pages`)
      .set(merchant.auth)
      .send({ title: 'About us', body: 'We make mugs.\n\nSince 2020.' })
      .expect(201);
    expect(about.body).toMatchObject({ handle: 'about-us', published: true });

    // Same title again gets a unique handle.
    const second = await ctx
      .http()
      .post(`${admin}/pages`)
      .set(merchant.auth)
      .send({ title: 'About us', published: false })
      .expect(201);
    expect(second.body.handle).toBe('about-us-2');

    const page = await sf('get', '/pages/about-us').expect(200);
    expect(page.body).toEqual({
      title: 'About us',
      handle: 'about-us',
      body: 'We make mugs.\n\nSince 2020.',
    });
    await sf('get', '/pages/about-us-2').expect(404);

    await ctx
      .http()
      .put(`${admin}/pages/${about.body.id}`)
      .set(merchant.auth)
      .send({ title: 'About', handle: 'about', body: 'New', published: true })
      .expect(200);
    await sf('get', '/pages/about-us').expect(404);
    expect((await sf('get', '/pages/about').expect(200)).body.body).toBe('New');

    const list = await ctx.http().get(`${admin}/pages`).set(merchant.auth).expect(200);
    expect(list.body.map((p: { handle: string }) => p.handle)).toEqual(['about', 'about-us-2']);

    await ctx.http().delete(`${admin}/pages/${about.body.id}`).set(merchant.auth).expect(204);
    await sf('get', '/pages/about').expect(404);
  });

  it('keeps pages, policies and menus inside their store', async () => {
    const a = await setup();
    const b = await setup();
    const page = await ctx
      .http()
      .post(`${a.admin}/pages`)
      .set(a.merchant.auth)
      .send({ title: 'Secret' })
      .expect(201);
    await ctx
      .http()
      .put(`${a.admin}/policies/refund`)
      .set(a.merchant.auth)
      .send({ body: 'A refunds' })
      .expect(200);

    await ctx.http().get(`${b.admin}/pages/${page.body.id}`).set(b.merchant.auth).expect(404);
    await ctx
      .http()
      .put(`${b.admin}/pages/${page.body.id}`)
      .set(b.merchant.auth)
      .send({ title: 'Mine' })
      .expect(404);
    // Non-members get 404 for the whole store, not 403 (existence is not revealed).
    await ctx.http().get(`${a.admin}/pages`).set(b.merchant.auth).expect(404);
    await b.sf('get', '/pages/secret').expect(404);
    await b.sf('get', '/policies/refund').expect(404);
    expect((await a.sf('get', '/policies/refund').expect(200)).body.body).toBe('A refunds');
  });

  it('publishes policies and removes them when emptied', async () => {
    const { merchant, admin, sf } = await setup();
    await sf('get', '/policies/privacy').expect(404);
    await sf('get', '/policies/cookies').expect(400);

    await ctx
      .http()
      .put(`${admin}/policies/privacy`)
      .set(merchant.auth)
      .send({ body: '  We keep your data safe.  ' })
      .expect(200);
    const policy = await sf('get', '/policies/privacy').expect(200);
    expect(policy.body).toMatchObject({ kind: 'privacy', title: 'Privacy policy' });
    expect(policy.body.body).toBe('We keep your data safe.');

    const shop = await sf('get', '/shop').expect(200);
    expect(shop.body.policies).toEqual([{ kind: 'privacy', title: 'Privacy policy' }]);

    const all = await ctx.http().get(`${admin}/policies`).set(merchant.auth).expect(200);
    expect(all.body.map((p: { kind: string }) => p.kind)).toEqual([
      'refund',
      'privacy',
      'terms',
      'shipping',
      'contact',
    ]);

    await ctx
      .http()
      .put(`${admin}/policies/privacy`)
      .set(merchant.auth)
      .send({ body: '' })
      .expect(200);
    await sf('get', '/policies/privacy').expect(404);
    expect((await sf('get', '/shop').expect(200)).body.policies).toEqual([]);
  });

  it('resolves menus, dropping links to hidden or missing targets', async () => {
    const { merchant, admin, sf } = await setup();
    await ctx
      .http()
      .post(`${admin}/collections`)
      .set(merchant.auth)
      .send({ title: 'Mugs', handle: 'mugs' })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/collections`)
      .set(merchant.auth)
      .send({ title: 'Hidden', handle: 'hidden', published: false })
      .expect(201);

    // Default: catalog + published collections, search in the footer.
    const before = await sf('get', '/shop').expect(200);
    expect(before.body.menus.main).toEqual([
      { title: 'Shop all', href: '/collections/all', external: false },
      { title: 'Mugs', href: '/collections/mugs', external: false },
    ]);
    expect(before.body.menus.footer).toEqual([
      { title: 'Search', href: '/search', external: false },
    ]);

    await ctx
      .http()
      .post(`${admin}/pages`)
      .set(merchant.auth)
      .send({ title: 'FAQ', handle: 'faq' })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({ title: 'Draft mug', handle: 'draft-mug', variants: [{ price: 100 }] })
      .expect(201);

    const saved = await ctx
      .http()
      .put(`${admin}/menus/main`)
      .set(merchant.auth)
      .send({
        items: [
          { title: 'Home', link: { type: 'home' } },
          { title: 'Mugs', link: { type: 'collection', handle: 'mugs' } },
          { title: 'Hidden', link: { type: 'collection', handle: 'hidden' } },
          { title: 'Draft', link: { type: 'product', handle: 'draft-mug' } },
          { title: 'FAQ', link: { type: 'page', handle: 'faq' } },
          { title: 'Gone', link: { type: 'page', handle: 'missing' } },
          { title: 'Refunds', link: { type: 'policy', kind: 'refund' } },
          { title: 'Blog', link: { type: 'url', url: 'https://blog.example.com' } },
          { title: 'Sale', link: { type: 'url', url: '/search?q=sale' } },
        ],
      })
      .expect(200);
    expect(saved.body).toMatchObject({ handle: 'main', customized: true });
    expect(saved.body.items).toHaveLength(9);

    const after = await sf('get', '/shop').expect(200);
    expect(after.body.menus.main).toEqual([
      { title: 'Home', href: '/', external: false },
      { title: 'Mugs', href: '/collections/mugs', external: false },
      { title: 'FAQ', href: '/pages/faq', external: false },
      { title: 'Blog', href: 'https://blog.example.com', external: true },
      { title: 'Sale', href: '/search?q=sale', external: false },
    ]);

    await ctx
      .http()
      .put(`${admin}/menus/main`)
      .set(merchant.auth)
      .send({ items: [{ title: 'x', link: { type: 'url', url: 'javascript:alert(1)' } }] })
      .expect(400);
    await ctx
      .http()
      .put(`${admin}/menus/sidebar`)
      .set(merchant.auth)
      .send({ items: [] })
      .expect(400);

    // An empty saved menu stays empty; resetting restores the default.
    await ctx
      .http()
      .put(`${admin}/menus/footer`)
      .set(merchant.auth)
      .send({ items: [] })
      .expect(200);
    expect((await sf('get', '/shop').expect(200)).body.menus.footer).toEqual([]);
    await ctx.http().delete(`${admin}/menus/main`).set(merchant.auth).expect(204);
    const menus = await ctx.http().get(`${admin}/menus`).set(merchant.auth).expect(200);
    expect(menus.body).toEqual([
      { handle: 'main', items: [], customized: false },
      { handle: 'footer', items: [], customized: true },
    ]);
    expect((await sf('get', '/shop').expect(200)).body.menus.main).toHaveLength(2);
  });

  it('lists only published content in the sitemap', async () => {
    const { merchant, admin, sf } = await setup();
    await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({ title: 'Live mug', status: 'ACTIVE', variants: [{ price: 100 }] })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({ title: 'Draft mug', variants: [{ price: 100 }] })
      .expect(201);
    await ctx
      .http()
      .post(`${admin}/pages`)
      .set(merchant.auth)
      .send({ title: 'Hidden', published: false })
      .expect(201);
    await ctx
      .http()
      .put(`${admin}/policies/terms`)
      .set(merchant.auth)
      .send({ body: 'Be nice.' })
      .expect(200);

    const map = await sf('get', '/sitemap').expect(200);
    expect(map.body.products.map((p: { handle: string }) => p.handle)).toEqual(['live-mug']);
    expect(map.body.pages).toEqual([]);
    expect(map.body.policies).toEqual(['terms']);
  });

  it('locks a password-protected storefront until the visitor enters the password', async () => {
    const { merchant, admin, sf } = await setup();
    await ctx
      .http()
      .post(`${admin}/products`)
      .set(merchant.auth)
      .send({ title: 'Secret lamp', status: 'ACTIVE', variants: [{ price: 100 }] })
      .expect(201);
    const access = (body: object) =>
      ctx.http().put(`${admin}/storefront-access`).set(merchant.auth).send(body);
    await access({ enabled: true }).expect(400); // no password yet
    const saved = await access({
      enabled: true,
      password: 'opening-soon',
      message: 'Back in May',
    }).expect(200);
    expect(saved.body).toEqual({ enabled: true, password: 'opening-soon', message: 'Back in May' });

    // The shop summary says it is locked and hides navigation; everything else is refused.
    const shop = await sf('get', '/shop').expect(200);
    expect(shop.body).toMatchObject({
      locked: true,
      passwordMessage: 'Back in May',
      collections: [],
    });
    await sf('get', '/products').expect(403);
    await sf('get', '/products/secret-lamp').expect(403);
    await sf('post', '/cart').expect(403);

    await sf('post', '/password').send({ password: 'wrong' }).expect(401);
    const unlocked = await sf('post', '/password').send({ password: 'opening-soon' }).expect(200);
    const token = unlocked.body.accessToken as string;
    expect((await sf('get', '/shop', { access: token }).expect(200)).body.locked).toBe(false);
    await sf('get', '/products/secret-lamp', { access: token }).expect(200);

    // A token for one store does not open another.
    const other = await setup();
    await ctx
      .http()
      .put(`${other.admin}/storefront-access`)
      .set(other.merchant.auth)
      .send({ enabled: true, password: 'opening-soon' })
      .expect(200);
    await other.sf('get', '/products', { access: token }).expect(403);

    // Changing the password signs everyone out; turning protection off opens the store.
    await access({ enabled: true, password: 'new-password' }).expect(200);
    await sf('get', '/products', { access: token }).expect(403);
    await access({ enabled: false }).expect(200);
    await sf('get', '/products').expect(200);
    expect((await sf('get', '/shop').expect(200)).body.locked).toBe(false);
  });
});
