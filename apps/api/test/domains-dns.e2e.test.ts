import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DNS_VERIFIER, type DnsVerifier, zoneOf } from '../src/settings/domains.js';
import { createTestApp, merchantWithStore, resetDatabase, type TestContext } from './utils.js';

/** Public DNS as a table: name → answers per record type. */
let zone: Record<string, { txt?: string[]; cname?: string[]; a?: string[]; ns?: string[] }> = {};

const fakeDns: DnsVerifier = {
  simulated: false,
  hasTxtRecord: (name, value) => Promise.resolve((zone[name]?.txt ?? []).includes(value)),
  txt: (name) => Promise.resolve(zone[name]?.txt ?? []),
  cname: (name) => Promise.resolve(zone[name]?.cname ?? []),
  a: (name) => Promise.resolve(zone[name]?.a ?? []),
  ns: (name) => Promise.resolve(zone[name]?.ns ?? []),
};

describe('zoneOf', () => {
  it('finds the registered domain, including two-label suffixes', () => {
    expect(zoneOf('shop.example.com')).toBe('example.com');
    expect(zoneOf('example.com')).toBe('example.com');
    expect(zoneOf('www.example.co.in')).toBe('example.co.in');
    expect(zoneOf('example.co.in')).toBe('example.co.in');
  });
});

describe('Connecting a domain over DNS', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ overrides: [{ provide: DNS_VERIFIER, useValue: fakeDns }] });
    await resetDatabase(ctx.owner);
  });

  beforeEach(() => {
    zone = {};
  });

  afterAll(async () => {
    await ctx?.close();
  });

  async function add(hostname: string) {
    const { store, auth } = await merchantWithStore(ctx);
    const base = `/api/v1/admin/stores/${store.id}/domains`;
    const res = await ctx.http().post(base).set(auth).send({ hostname }).expect(201);
    return { base, auth, domain: res.body };
  }

  it('gives a subdomain a CNAME and the short names DNS dashboards ask for', async () => {
    const { domain } = await add('shop.acme-one.com');
    expect(domain).toMatchObject({
      apex: false,
      zone: 'acme-one.com',
      routingRecord: { type: 'CNAME', host: 'shop', name: 'shop.acme-one.com' },
      verificationRecord: { type: 'TXT', host: '_shop-verification.shop' },
    });
  });

  it('never tells a bare domain to use a CNAME', async () => {
    const { domain } = await add('acme-two.co.in');
    expect(domain.apex).toBe(true);
    expect(domain.routingRecord.type).not.toBe('CNAME');
    expect(domain.routingRecord.host).toBe('@');
  });

  it('reports each record as missing, wrong or found, and the DNS host', async () => {
    const { base, auth, domain } = await add('www.acme-three.com');
    const check = () => ctx.http().get(`${base}/${domain.id}/check`).set(auth).expect(200);

    let result = await check();
    expect(result.body).toMatchObject({
      simulated: false,
      dnsProvider: null,
      verification: { status: 'missing' },
      routing: { status: 'missing' },
    });

    zone = {
      [domain.verificationRecord.name]: { txt: ['something-else'] },
      'www.acme-three.com': { cname: ['old-host.example.net.'] },
      'acme-three.com': { ns: ['ana.ns.cloudflare.com'] },
    };
    result = await check();
    expect(result.body).toMatchObject({
      dnsProvider: 'Cloudflare',
      verification: { status: 'wrong', found: ['something-else'] },
      routing: { status: 'wrong', found: ['old-host.example.net.'] },
    });
    const refused = await ctx.http().post(`${base}/${domain.id}/verify`).set(auth).expect(400);
    expect(refused.body.detail).toMatch(/does not match/);

    zone[domain.verificationRecord.name] = { txt: [domain.verificationRecord.value] };
    zone['www.acme-three.com'] = { cname: [`${domain.routingRecord.value}.`] };
    result = await check();
    expect(result.body).toMatchObject({
      verification: { status: 'found' },
      routing: { status: 'found' },
    });
    const verified = await ctx.http().post(`${base}/${domain.id}/verify`).set(auth).expect(200);
    expect(verified.body).toMatchObject({ verified: true, isPrimary: true });
  });

  it('treats a proxied or flattened record pointing at the platform as connected', async () => {
    const { base, auth, domain } = await add('shop.acme-four.com');
    zone = {
      'shop.acme-four.com': { a: ['198.51.100.7'] },
      [domain.routingRecord.value]: { a: ['198.51.100.7'] },
    };
    const result = await ctx.http().get(`${base}/${domain.id}/check`).set(auth).expect(200);
    expect(result.body.routing.status).toBe('found');
  });
});
