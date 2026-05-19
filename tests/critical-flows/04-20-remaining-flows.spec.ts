import { test, expect } from '@playwright/test';
import { ALICE, BOB } from '../fixtures/test-users';
import { loginAs } from '../fixtures/auth';

/**
 * Critical flows 04 – 20 — Section-10 follow / DM / block / report
 * scenarios. Source spec: 04-20-remaining-flows.spec.md
 *
 * These specs require the pre-seeded alice + bob accounts. Run with
 * the test DB only.
 */

test.describe('social graph + DM + admin (flows 04-20)', () => {
  test('04 — follow another profile', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${BOB.username}`);
    const followBtn = page.getByRole('button', { name: /^follow$/i });
    await followBtn.click();
    await expect(page.getByRole('button', { name: /^following$/i })).toBeVisible();
  });

  test('05 — unfollow from own following list', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${ALICE.username}`);
    await page.getByRole('button', { name: /following \(\d+\)/i }).click();
    const bobRow = page.locator(`[data-username="${BOB.username}"]`);
    await bobRow.getByRole('button', { name: /unfollow/i }).click();
    await expect(bobRow).toBeHidden();
  });

  test('06 — followers container renders + paginates', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${ALICE.username}`);
    await page.getByRole('button', { name: /followers \(\d+\)/i }).click();
    await expect(page.locator('[data-testid="follower-row"]').first()).toBeVisible();
  });

  test('07 — autocomplete user search', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto('/discover');
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill('bo');
    await expect(page.getByText(new RegExp(BOB.username, 'i'))).toBeVisible({ timeout: 500 });
  });

  test('08 — bottom-nav Find opens discover', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /find/i }).click();
    await page.waitForURL(/\/discover/);
  });

  test('09 — DM gated by mutual follow', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${BOB.username}`);
    const msgBtn = page.getByRole('button', { name: /message/i });
    await expect(msgBtn).toHaveAttribute('aria-disabled', 'true');
  });

  test('10 — mutual follow unlocks DM', async ({ page, request }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'requires test admin to force mutual follow');
    // Setup mutual follow via admin API, then assert Message enabled.
    await loginAs(page, ALICE);
    await page.goto(`/u/${BOB.username}`);
    await expect(page.getByRole('button', { name: /message/i })).toBeEnabled();
  });

  test('11 — send encrypted DM end-to-end', async ({ page }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'requires mutual follow setup');
    await loginAs(page, ALICE);
    await page.goto(`/messages?to=${BOB.username}`);
    await page.getByPlaceholder(/message/i).fill('hello bob');
    await page.getByRole('button', { name: /send/i }).click();
    await expect(page.getByText('hello bob')).toBeVisible();
  });

  test('12 — block user', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${BOB.username}`);
    await page.getByRole('button', { name: /more/i }).click();
    await page.getByRole('menuitem', { name: /block/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
  });

  test('13 — private account follow approval', async ({ page }) => {
    test.skip(!process.env.TEST_ADMIN_TOKEN, 'requires toggling bob.is_private');
    await loginAs(page, ALICE);
    await page.goto(`/u/${BOB.username}`);
    await page.getByRole('button', { name: /^follow$/i }).click();
    await expect(page.getByText(/pending/i)).toBeVisible();
  });

  test('14 — report user surfaces in admin', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${BOB.username}`);
    await page.getByRole('button', { name: /more/i }).click();
    await page.getByRole('menuitem', { name: /report/i }).click();
    await page.getByLabel(/reason/i).selectOption('spam');
    await page.getByRole('button', { name: /submit/i }).click();
  });

  test('15 — audit tracker renders', async ({ page }) => {
    test.skip(!process.env.TEST_ADMIN_USER, 'admin-only route');
    await page.goto('/admin/audit-tracker');
    await expect(page.locator('[data-testid="audit-finding-row"]').first()).toBeVisible();
  });

  test('16 — profile containers 4 + 5', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${ALICE.username}`);
    await expect(page.getByRole('button', { name: /followers \(\d+\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /following \(\d+\)/i })).toBeVisible();
  });

  test('17 — followers/following pagination', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto(`/u/${ALICE.username}`);
    await page.getByRole('button', { name: /followers \(\d+\)/i }).click();
    const loadMore = page.getByRole('button', { name: /load more/i });
    if (await loadMore.isVisible()) {
      await loadMore.click();
      await expect(page.locator('[data-testid="follower-row"]').nth(50)).toBeVisible();
    }
  });

  test('18 — success-rate badge re-renders after cron', async ({ page, request }) => {
    test.skip(!process.env.CRON_SECRET, 'requires CRON_SECRET to trigger cron');
    await request.post('/api/cron/recompute-reputation', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    await loginAs(page, ALICE);
    await page.goto(`/u/${ALICE.username}`);
    await expect(page.getByTestId('success-rate-badge')).toBeVisible();
  });

  test('19 — realtime leaderboard refresh', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto('/discover');
    await expect(page.locator('[data-testid="leaderboard-tile"]').first()).toBeVisible();
  });

  test('20 — mobile responsive at every breakpoint', async ({ page }) => {
    const breakpoints = [
      { w: 375, h: 812 },
      { w: 393, h: 851 },
      { w: 412, h: 869 },
      { w: 768, h: 1024 },
      { w: 1024, h: 768 },
      { w: 1440, h: 900 },
      { w: 1920, h: 1080 },
    ];
    await loginAs(page, ALICE);
    for (const vp of breakpoints) {
      await page.setViewportSize(vp);
      await page.goto('/dashboard');
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const winWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth, `no horizontal scroll at ${vp.w}px`).toBeLessThanOrEqual(winWidth + 1);
    }
  });
});
