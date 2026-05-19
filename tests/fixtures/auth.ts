import type { Page } from '@playwright/test';
import { ALICE, BOB } from './test-users';

export async function loginAs(page: Page, user: typeof ALICE | typeof BOB) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding|u\/)/, { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}
