/**
 * Pre-seeded test accounts. The CI / local Playwright runner expects
 * these rows to exist before the critical-flow specs are executed.
 *
 * Seed via supabase migration `tests/fixtures/seed.sql` (run against
 * the test DB only) or the `npm run test:seed` helper documented in
 * tests/README.md.
 */
export const ALICE = {
  email: 'alice@test.naka',
  username: 'alice',
  password: process.env.TEST_USER_PASSWORD ?? 'naka-test-password-1',
};

export const BOB = {
  email: 'bob@test.naka',
  username: 'bob',
  password: process.env.TEST_USER_PASSWORD ?? 'naka-test-password-1',
};

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5000';
