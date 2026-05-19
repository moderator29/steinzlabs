import { test, expect } from '@playwright/test';

/**
 * Critical flow 01 — Signup → onboarding → dashboard.
 *
 * Source spec: tests/critical-flows/01-signup-onboarding.spec.md
 *
 * Requires a clean test DB with a free email available. The test
 * deletes the user it created in afterEach via a server admin route.
 */

const email = `e2e-${Date.now()}@test.naka`;
const password = 'naka-test-password-1';

test.describe('signup → onboarding → dashboard', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('completes the 10-card onboarding and lands on dashboard', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.getByRole('link', { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/signup/);

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign up|create account/i }).click();

    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByLabel(/onboarding step 1 of 10/i)).toBeVisible();

    for (let step = 1; step <= 9; step += 1) {
      await page.getByRole('button', { name: /next/i }).click();
      await expect(page.getByLabel(new RegExp(`onboarding step ${step + 1} of 10`, 'i'))).toBeVisible();
    }
    await page.getByRole('button', { name: /finish/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.locator('nav[aria-label="bottom-nav"]')).toBeVisible();

    expect(consoleErrors, `no console errors during flow: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test.afterAll(async ({ request }) => {
    if (!process.env.TEST_ADMIN_TOKEN) return;
    await request.post('/api/test/cleanup-user', {
      headers: { authorization: `Bearer ${process.env.TEST_ADMIN_TOKEN}` },
      data: { email },
    });
  });
});
