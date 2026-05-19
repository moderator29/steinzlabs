import { test, expect } from '@playwright/test';

const email = `e2e-skip-${Date.now()}@test.naka`;
const password = 'naka-test-password-1';

test.describe('skip onboarding → replay from settings', () => {
  test('skip → confirm → land on dashboard → replay from settings', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign up|create account/i }).click();
    await page.waitForURL(/\/onboarding/);

    await page.getByRole('button', { name: /skip tour/i }).click();
    await expect(page.getByText(/skip anyway/i)).toBeVisible();
    await page.getByRole('button', { name: /skip anyway/i }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto('/settings');
    const replay = page.getByRole('button', { name: /replay onboarding/i });
    await expect(replay).toBeVisible();
    await replay.click();

    await page.goto('/onboarding');
    await expect(page.getByLabel(/onboarding step 1 of 10/i)).toBeVisible();
  });

  test.afterAll(async ({ request }) => {
    if (!process.env.TEST_ADMIN_TOKEN) return;
    await request.post('/api/test/cleanup-user', {
      headers: { authorization: `Bearer ${process.env.TEST_ADMIN_TOKEN}` },
      data: { email },
    });
  });
});
