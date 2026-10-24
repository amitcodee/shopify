import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { THEME_DRAFT_HEADER, type Theme } from '@repo/contracts';
import {
  THEME_AI_CLIENT,
  type ThemeAiClient,
  type ThemeAiOutput,
} from '../src/settings/theme-ai.js';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
  storefrontClient,
  type TestContext,
} from './utils.js';

/** Every setting unchanged (null), so a test only names what the "model" changes. */
function noChanges(): ThemeAiOutput['changes'] {
  return new Proxy({} as ThemeAiOutput['changes'], { get: () => null, ownKeys: () => [] });
}

/** A stand-in for Claude that returns whatever the test queues, and records what it was asked. */
class FakeAi implements ThemeAiClient {
  next: ThemeAiOutput | null = null;
  calls: { prompt: string; theme: Theme; storeName: string }[] = [];
  suggest(prompt: string, theme: Theme, storeName: string) {
    this.calls.push({ prompt, theme, storeName });
    return Promise.resolve(this.next);
  }
}

describe('Theme editor: drafts, preview tokens, publishing, apps and AI', () => {
  let ctx: TestContext;
  const ai = new FakeAi();

  beforeAll(async () => {
    ctx = await createTestApp({ overrides: [{ provide: THEME_AI_CLIENT, useValue: ai }] });
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function setup() {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const sf = storefrontClient(ctx, `${m.store.subdomain}.localhost:3200`);
    return { m, admin, sf };
  }

  it('keeps a draft separate from the live theme until it is published', async () => {
    const { m, admin, sf } = await setup();
    expect((await ctx.http().get(`${admin}/theme/draft`).set(m.auth).expect(200)).body).toEqual({
      draft: null,
    });

    const draft = await ctx
      .http()
      .put(`${admin}/theme/draft`)
      .set(m.auth)
      .send({
        preset: 'bold',
        settings: { brandColor: '#0f766e', sectionOrder: ['newsletter', 'trustBar', 'bogus'] },
      })
      .expect(200);
    // The section order keeps known ids once each, then appends the rest in default order.
    expect(draft.body.settings.sectionOrder).toEqual([
      'newsletter',
      'trustBar',
      'collections',
      'featuredProducts',
      'carousels',
      'brandStory',
      'blogPosts',
    ]);

    // Shoppers still see the live theme.
    expect((await sf('get', '/shop').expect(200)).body.theme.preset).toBe('minimal');

    // A preview token shows the draft — but only on this store, and only if it is genuine.
    const { token } = (
      await ctx.http().post(`${admin}/theme/preview-token`).set(m.auth).expect(200)
    ).body;
    const previewed = await sf('get', '/shop').set(THEME_DRAFT_HEADER, token).expect(200);
    expect(previewed.body.theme).toMatchObject({
      preset: 'bold',
      settings: { brandColor: '#0f766e' },
    });
    const forged = `${token.slice(0, -2)}xx`;
    expect(
      (await sf('get', '/shop').set(THEME_DRAFT_HEADER, forged).expect(200)).body.theme.preset,
    ).toBe('minimal');
    const other = await setup();
    expect(
      (await other.sf('get', '/shop').set(THEME_DRAFT_HEADER, token).expect(200)).body.theme.preset,
    ).toBe('minimal');

    // Publishing makes the draft live and clears it.
    const published = await ctx.http().post(`${admin}/theme/draft/publish`).set(m.auth).expect(200);
    expect(published.body.preset).toBe('bold');
    expect(
      (await ctx.http().get(`${admin}/theme/draft`).set(m.auth).expect(200)).body.draft,
    ).toBeNull();
    expect(
      (await ctx.http().get(`${admin}/theme`).set(m.auth).expect(200)).body.settings.brandColor,
    ).toBe('#0f766e');
    await ctx.http().post(`${admin}/theme/draft/publish`).set(m.auth).expect(404);

    const audit = await ctx.platform.auditLog.findMany({
      where: { storeId: m.store.id, action: 'theme.published' },
    });
    expect(audit).toHaveLength(1);
  });

  it('discards drafts and rejects invalid ones and other stores', async () => {
    const { m, admin } = await setup();
    await ctx
      .http()
      .put(`${admin}/theme/draft`)
      .set(m.auth)
      .send({ preset: 'minimal', settings: { brandColor: 'red' } })
      .expect(400);
    await ctx
      .http()
      .put(`${admin}/theme/draft`)
      .set(m.auth)
      .send({ preset: 'split', settings: {} })
      .expect(200);
    await ctx.http().delete(`${admin}/theme/draft`).set(m.auth).expect(204);
    expect(
      (await ctx.http().get(`${admin}/theme/draft`).set(m.auth).expect(200)).body.draft,
    ).toBeNull();

    const stranger = await merchantWithStore(ctx);
    // Other stores' ids are not revealed.
    await ctx.http().get(`${admin}/theme/draft`).set(stranger.auth).expect(404);
    await ctx.http().post(`${admin}/theme/preview-token`).set(stranger.auth).expect(404);
  });

  it('installs and configures apps, served to the storefront', async () => {
    const { m, admin, sf } = await setup();
    const initial = (await ctx.http().get(`${admin}/apps`).set(m.auth).expect(200)).body;
    expect(initial.whatsapp.enabled).toBe(false);
    expect((await sf('get', '/shop').expect(200)).body.apps.freeShippingBar.enabled).toBe(false);

    await ctx
      .http()
      .put(`${admin}/apps`)
      .set(m.auth)
      .send({ ...initial, whatsapp: { enabled: true, phone: '+91 98', message: 'Hi' } })
      .expect(400);
    const saved = await ctx
      .http()
      .put(`${admin}/apps`)
      .set(m.auth)
      .send({
        ...initial,
        whatsapp: { enabled: true, phone: '919876543210', message: 'Hello!' },
        freeShippingBar: { ...initial.freeShippingBar, enabled: true, threshold: 7500 },
      })
      .expect(200);
    expect(saved.body.whatsapp.phone).toBe('919876543210');
    const shop = (await sf('get', '/shop').expect(200)).body;
    expect(shop.apps.whatsapp).toEqual({ enabled: true, phone: '919876543210', message: 'Hello!' });
    expect(shop.apps.freeShippingBar).toMatchObject({ enabled: true, threshold: 7500 });
  });

  it('applies only valid AI suggestions and reports what changed', async () => {
    const { m, admin } = await setup();
    expect((await ctx.http().get(`${admin}/theme/ai`).set(m.auth).expect(200)).body.enabled).toBe(
      true,
    );
    const theme = (await ctx.http().get(`${admin}/theme`).set(m.auth).expect(200)).body;
    ai.next = {
      summary: 'Switched to a dark, luxurious look.',
      preset: 'editorial',
      changes: {
        ...noChanges(),
        backgroundColor: '#0b0b0e',
        textColor: '#ededf0',
        brandColor: 'not-a-color',
        headingFont: 'serif',
        heroTitle: 'Quiet luxury',
        gridColumns: 9,
      },
    };
    const res = await ctx
      .http()
      .post(`${admin}/theme/ai`)
      .set(m.auth)
      .send({ prompt: 'Make it dark and luxurious', theme })
      .expect(200);
    expect(res.body.summary).toBe('Switched to a dark, luxurious look.');
    expect(res.body.theme.preset).toBe('editorial');
    expect(res.body.theme.settings).toMatchObject({
      backgroundColor: '#0b0b0e',
      textColor: '#ededf0',
      headingFont: 'serif',
      heroTitle: 'Quiet luxury',
      // Invalid suggestions are dropped; the previous values stay.
      brandColor: theme.settings.brandColor,
      gridColumns: theme.settings.gridColumns,
    });
    expect(res.body.changed.sort()).toEqual(
      ['preset', 'backgroundColor', 'textColor', 'headingFont', 'heroTitle'].sort(),
    );
    expect(ai.calls.at(-1)).toMatchObject({
      prompt: 'Make it dark and luxurious',
      storeName: m.store.name,
    });
    // Suggestions are not saved anywhere until the merchant keeps them.
    expect(
      (await ctx.http().get(`${admin}/theme/draft`).set(m.auth).expect(200)).body.draft,
    ).toBeNull();

    ai.next = null;
    await ctx
      .http()
      .post(`${admin}/theme/ai`)
      .set(m.auth)
      .send({ prompt: 'Something unhelpful', theme })
      .expect(422);
    await ctx.http().post(`${admin}/theme/ai`).set(m.auth).send({ prompt: 'x', theme }).expect(400);
  });
});

describe('Theme editor AI without an API key', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ overrides: [{ provide: THEME_AI_CLIENT, useValue: null }] });
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('explains that the assistant is not set up', async () => {
    const m = await merchantWithStore(ctx);
    const admin = `/api/v1/admin/stores/${m.store.id}`;
    const theme = (await ctx.http().get(`${admin}/theme`).set(m.auth).expect(200)).body;
    expect((await ctx.http().get(`${admin}/theme/ai`).set(m.auth).expect(200)).body).toEqual({
      enabled: false,
    });
    await ctx
      .http()
      .post(`${admin}/theme/ai`)
      .set(m.auth)
      .send({ prompt: 'Make it blue', theme })
      .expect(503);
  });
});
