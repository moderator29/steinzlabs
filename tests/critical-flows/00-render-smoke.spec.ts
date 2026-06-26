import { test, expect } from '@playwright/test';

/**
 * Render smoke test for the critical PUBLIC surfaces.
 *
 * Why this exists: a whole class of bugs is invisible to `tsc` but crashes the
 * page at runtime — the canonical example being a wallet hook (useAppKit) that
 * throws on first render if the modal isn't registered. Every page below mounts
 * the wallet-connect stack and/or the auth surface, so loading each with NO auth
 * and asserting zero uncaught exceptions catches that class before a tester does.
 *
 * It runs across every viewport in playwright.config (iPhone SE → 1920 desktop),
 * so it doubles as a "does it even render on mobile/tablet/desktop" check.
 *
 * Run against a deploy:  PLAYWRIGHT_BASE_URL=https://nakalabs.xyz npx playwright test 00-render-smoke
 */

const PUBLIC_ROUTES: ReadonlyArray<{ path: string; name: string }> = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/signup', name: 'signup' },
  { path: '/naka-cult', name: 'naka-cult landing' },
  { path: '/terms', name: 'terms' },
  { path: '/privacy', name: 'privacy' },
];

for (const route of PUBLIC_ROUTES) {
  test(`renders ${route.name} with no uncaught errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const res = await page.goto(route.path, { waitUntil: 'load' });

    // Route must respond OK (redirects resolve to a 2xx final response).
    expect(res, `no response for ${route.path}`).toBeTruthy();
    expect(res!.status(), `bad status for ${route.path}`).toBeLessThan(400);

    // Give the client time to hydrate so any first-render throw surfaces.
    await page.waitForTimeout(2500);

    // The page must actually paint, not Next's error boundary.
    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.getByText(/Application error|something went wrong|client-side exception/i),
    ).toHaveCount(0);

    // No uncaught JS exception — this is what catches the wallet-hook crash class.
    expect(
      errors,
      `uncaught error(s) on ${route.path}:\n${errors.join('\n')}`,
    ).toEqual([]);
  });
}
