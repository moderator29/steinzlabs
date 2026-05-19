import { test, expect } from '@playwright/test';
import { ALICE } from '../fixtures/test-users';
import { loginAs } from '../fixtures/auth';

test.describe('discover → leaderboards → profile', () => {
  test('renders 8 leaderboards and drills into a profile', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto('/discover');

    const tiles = page.locator('[data-testid="leaderboard-tile"]');
    await expect(tiles).toHaveCount(8, { timeout: 5_000 });

    const firstRow = tiles.first().locator('[data-testid="leaderboard-row"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    await page.waitForURL(/\/u\//);
    await expect(page.getByTestId('profile-name')).toBeVisible();
    await expect(page.getByTestId('profile-followers')).toBeVisible();
  });

  test('every leaderboard row has aria-label with metric + value', async ({ page }) => {
    await loginAs(page, ALICE);
    await page.goto('/discover');
    const rows = await page.locator('[data-testid="leaderboard-row"]').all();
    for (const row of rows) {
      const label = await row.getAttribute('aria-label');
      expect(label, 'leaderboard row missing aria-label').toBeTruthy();
    }
  });
});
