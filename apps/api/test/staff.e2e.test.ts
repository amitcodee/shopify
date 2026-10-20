import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
  signup,
  type TestContext,
  uniqueEmail,
} from './utils.js';

/** The accept link only travels by email; read it from the in-memory mailbox. */
function inviteTokenFor(mailbox: MemoryEmailSender, email: string): string {
  const message = mailbox.sent.findLast((m) => m.to === email);
  return /\/invite\/([A-Za-z0-9_-]+)/.exec(message?.text ?? '')?.[1] ?? '';
}

describe('Staff & invitations', () => {
  let ctx: TestContext;
  let mailbox: MemoryEmailSender;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    mailbox = (ctx.app as INestApplication).get(EMAIL_SENDER);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('invites a new person who creates an account and joins with granted permissions', async () => {
    const owner = await merchantWithStore(ctx);
    const email = uniqueEmail('new-staff');
    const base = `/api/v1/admin/stores/${owner.store.id}/staff`;

    const invite = await ctx
      .http()
      .post(`${base}/invitations`)
      .set(owner.auth)
      .send({ email, role: 'STAFF', permissions: ['orders:read', 'products:read'] })
      .expect(201);
    expect(mailbox.sent.at(-1)).toMatchObject({ to: email });
    expect(invite.body.acceptUrl).toBeUndefined(); // never returned to the inviter

    const token = inviteTokenFor(mailbox, email);
    const preview = await ctx.http().get(`/api/v1/invitations/${token}`).expect(200);
    expect(preview.body).toMatchObject({ email, role: 'STAFF', accountExists: false });

    const accepted = await ctx
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .send({ name: 'New Staff', password: 'staff-password-123' })
      .expect(201);
    expect(accepted.body.storeId).toBe(owner.store.id);
    const staffAuth = { Authorization: `Bearer ${accepted.body.session.token}` };

    const detail = await ctx
      .http()
      .get(`/api/v1/admin/stores/${owner.store.id}`)
      .set(staffAuth)
      .expect(200);
    expect(detail.body.permissions.sort()).toEqual(['orders:read', 'products:read']);

    // Token is single use.
    await ctx.http().post(`/api/v1/invitations/${token}/accept`).send({}).expect(404);

    const list = await ctx.http().get(base).set(owner.auth).expect(200);
    expect(list.body.members.map((m: { email: string }) => m.email)).toContain(email);
    expect(list.body.invitations).toHaveLength(0);
  });

  it('requires existing accounts to be signed in as the invited email', async () => {
    const owner = await merchantWithStore(ctx);
    const invitee = await signup(ctx);
    const stranger = await signup(ctx);

    await ctx
      .http()
      .post(`/api/v1/admin/stores/${owner.store.id}/staff/invitations`)
      .set(owner.auth)
      .send({ email: invitee.user.email, role: 'ADMIN' })
      .expect(201);
    const token = inviteTokenFor(mailbox, invitee.user.email);

    await ctx.http().post(`/api/v1/invitations/${token}/accept`).send({}).expect(403);
    await ctx
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({})
      .expect(403);
    const ok = await ctx
      .http()
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .send({})
      .expect(201);
    expect(ok.body.session).toBeNull();

    const detail = await ctx
      .http()
      .get(`/api/v1/admin/stores/${owner.store.id}`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .expect(200);
    expect(detail.body.role).toBe('ADMIN');
    expect(detail.body.permissions).not.toContain('staff:manage');
  });

  it('only owners manage staff; the owner cannot be demoted or removed', async () => {
    const owner = await merchantWithStore(ctx);
    const admin = await signup(ctx);
    await ctx.platform.storeMember.create({
      data: { storeId: owner.store.id, userId: admin.user.id, role: 'ADMIN' },
    });
    const base = `/api/v1/admin/stores/${owner.store.id}/staff`;
    const adminAuth = { Authorization: `Bearer ${admin.token}` };

    await ctx
      .http()
      .post(`${base}/invitations`)
      .set(adminAuth)
      .send({ email: uniqueEmail(), role: 'STAFF' })
      .expect(403);

    const list = await ctx.http().get(base).set(owner.auth).expect(200);
    const ownerMember = list.body.members.find((m: { role: string }) => m.role === 'OWNER');
    const adminMember = list.body.members.find((m: { role: string }) => m.role === 'ADMIN');

    await ctx
      .http()
      .patch(`${base}/members/${ownerMember.id}`)
      .set(owner.auth)
      .send({ role: 'STAFF' })
      .expect(403);
    await ctx.http().delete(`${base}/members/${ownerMember.id}`).set(owner.auth).expect(403);

    await ctx
      .http()
      .patch(`${base}/members/${adminMember.id}`)
      .set(owner.auth)
      .send({ role: 'STAFF', permissions: ['orders:read'] })
      .expect(204);
    await ctx
      .http()
      .get(`/api/v1/admin/stores/${owner.store.id}/products`)
      .set(adminAuth)
      .expect(403);

    await ctx.http().delete(`${base}/members/${adminMember.id}`).set(owner.auth).expect(204);
    await ctx.http().get(`/api/v1/admin/stores/${owner.store.id}`).set(adminAuth).expect(404);
  });

  it('cannot escalate to OWNER, rejects duplicates, and revokes invitations', async () => {
    const owner = await merchantWithStore(ctx);
    const base = `/api/v1/admin/stores/${owner.store.id}/staff/invitations`;
    await ctx
      .http()
      .post(base)
      .set(owner.auth)
      .send({ email: uniqueEmail(), role: 'OWNER' })
      .expect(400);
    await ctx
      .http()
      .post(base)
      .set(owner.auth)
      .send({ email: owner.session.user.email, role: 'ADMIN' })
      .expect(409);

    const invitedEmail = uniqueEmail();
    const invite = await ctx
      .http()
      .post(base)
      .set(owner.auth)
      .send({ email: invitedEmail, role: 'STAFF' })
      .expect(201);
    const token = inviteTokenFor(mailbox, invitedEmail);
    await ctx.http().get(`/api/v1/invitations/${token}`).expect(200);
    await ctx.http().delete(`${base}/${invite.body.id}`).set(owner.auth).expect(204);
    await ctx.http().get(`/api/v1/invitations/${token}`).expect(404);
  });

  it('staff with staff:manage cannot grant more than they hold or touch their own access', async () => {
    const owner = await merchantWithStore(ctx);
    const manager = await signup(ctx);
    const membership = await ctx.platform.storeMember.create({
      data: {
        storeId: owner.store.id,
        userId: manager.user.id,
        role: 'STAFF',
        permissions: ['staff:manage', 'orders:read'],
      },
    });
    // Room for more staff than the Starter plan's two seats.
    const growth = await ctx.platform.plan.findUniqueOrThrow({ where: { code: 'growth' } });
    await ctx.platform.subscription.update({
      where: { storeId: owner.store.id },
      data: { planId: growth.id },
    });
    const base = `/api/v1/admin/stores/${owner.store.id}/staff`;
    const auth = { Authorization: `Bearer ${manager.token}` };
    const invite = (body: object) =>
      ctx
        .http()
        .post(`${base}/invitations`)
        .set(auth)
        .send({ email: uniqueEmail(), ...body });

    await invite({ role: 'ADMIN' }).expect(403);
    await invite({ role: 'STAFF', permissions: ['products:write'] }).expect(403);
    await invite({ role: 'STAFF', permissions: ['staff:manage'] }).expect(403);
    await invite({ role: 'STAFF', permissions: ['orders:read'] }).expect(201);

    await ctx
      .http()
      .patch(`${base}/members/${membership.id}`)
      .set(auth)
      .send({ role: 'STAFF', permissions: ['staff:manage', 'orders:read', 'products:write'] })
      .expect(403);
    await ctx.http().delete(`${base}/members/${membership.id}`).set(auth).expect(403);
  });

  it("cannot manage another store's staff", async () => {
    const alice = await merchantWithStore(ctx);
    const bob = await merchantWithStore(ctx);
    const aliceList = await ctx
      .http()
      .get(`/api/v1/admin/stores/${alice.store.id}/staff`)
      .set(alice.auth)
      .expect(200);
    const aliceOwnerId = aliceList.body.members[0].id;

    await ctx.http().get(`/api/v1/admin/stores/${alice.store.id}/staff`).set(bob.auth).expect(404);
    await ctx
      .http()
      .delete(`/api/v1/admin/stores/${bob.store.id}/staff/members/${aliceOwnerId}`)
      .set(bob.auth)
      .expect(404);
  });
});
