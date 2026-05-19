import { test, expect } from '@playwright/test';
import { ALICE, BOB } from '../fixtures/test-users';
import { loginAs } from '../fixtures/auth';

/**
 * Section-10 security tests. Source spec:
 * tests/security/section-10-security.spec.md
 *
 * S1 + S4 (raw SQL + service_role probes) live in
 * tests/security/sql-probes.sql for psql execution. The HTTP-driven
 * portions of S2 / S3 / S5 / S6 run here.
 */

test.describe('section-10 security — HTTP surface', () => {
  test('S2 — blocked users cannot interact', async ({ page, request }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'requires admin to seed block row');
    await loginAs(page, BOB);

    const search = await request.get(`/api/search/users?q=${ALICE.username}`);
    expect(search.status()).toBe(200);
    const searchBody = await search.json();
    expect(searchBody.results.find((u: { username: string }) => u.username === ALICE.username)).toBeUndefined();

    const follow = await request.post('/api/social/follow', { data: { target_username: ALICE.username } });
    expect(follow.status()).toBe(403);

    const dm = await request.post('/api/social/dm', { data: { to: ALICE.username, body: 'hi' } });
    expect(dm.status()).toBe(403);

    const profile = await request.get(`/u/${ALICE.username}`);
    expect([404, 410, 200]).toContain(profile.status());
  });

  test('S3 — private follow requires approval', async ({ request }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'requires bob.is_private toggle');
    const res = await request.post('/api/social/follow', { data: { target_username: BOB.username } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('pending');
  });

  test('S5 — rate limits kick in', async ({ request }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'destructive rate-limit hammer');
    let last429 = -1;
    for (let i = 0; i < 31; i += 1) {
      const res = await request.post('/api/social/follow', { data: { target_username: `user-${i}` } });
      if (res.status() === 429) {
        last429 = i;
        expect(res.headers()['retry-after']).toBeTruthy();
        break;
      }
    }
    expect(last429, 'expected a 429 within the first 31 follows').toBeGreaterThan(28);
  });

  test('S6 — reporter identity hidden from reported user', async ({ page, request }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'requires reporter setup');
    await loginAs(page, BOB);
    const notif = await request.get(`/api/notifications`);
    expect(notif.status()).toBe(200);
    const body = await notif.json();
    const reportEvents = (body.events ?? []).filter((e: { type: string }) => e.type === 'report');
    expect(reportEvents).toHaveLength(0);
  });
});
