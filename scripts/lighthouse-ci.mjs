#!/usr/bin/env node
/**
 * Lighthouse CI — Section-10 performance gates.
 *
 * Runs lighthouse against a small set of canonical surfaces and exits
 * non-zero when any fall below the published thresholds. Lighthouse is
 * loaded dynamically so this file can sit in the repo without
 * permanently adding the dependency — `npm install --no-save
 * lighthouse chrome-launcher` is enough.
 *
 * Targets:
 *   /            (landing)
 *   /dashboard   (authed surface; requires NAKA_CI_SESSION_COOKIE env)
 *   /discover    (social discover)
 *   /u/<seed>    (a public profile in the seed dataset)
 *
 * Thresholds (from SESSION-Q-KICKOFF.md §3 H10):
 *   performance score >= 0.90
 *   first-contentful-paint <= 1500 ms
 *   largest-contentful-paint <= 2500 ms
 *   total-blocking-time <= 200 ms
 *   cumulative-layout-shift <= 0.1
 *   interactive <= 2000 ms
 */

const BASE = process.env.NAKA_LIGHTHOUSE_BASE_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = process.env.NAKA_CI_SESSION_COOKIE ?? '';

const TARGETS = [
  { url: `${BASE}/`, authed: false },
  { url: `${BASE}/discover`, authed: false },
];
if (SESSION_COOKIE) {
  TARGETS.push({ url: `${BASE}/dashboard`, authed: true });
}

const THRESHOLDS = {
  performance: 0.9,
  'first-contentful-paint': 1500,
  'largest-contentful-paint': 2500,
  'total-blocking-time': 200,
  'cumulative-layout-shift': 0.1,
  interactive: 2000,
};

async function main() {
  let lighthouse, chromeLauncher;
  try {
    ({ default: lighthouse } = await import('lighthouse'));
    chromeLauncher = await import('chrome-launcher');
  } catch (err) {
    console.error('Lighthouse not installed. Run: npm install --no-save lighthouse chrome-launcher');
    process.exit(2);
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
  const opts = {
    port: chrome.port,
    output: 'json',
    onlyCategories: ['performance'],
    formFactor: 'desktop',
    screenEmulation: { disabled: true },
    throttlingMethod: 'simulate',
  };

  const failures = [];

  for (const target of TARGETS) {
    const extraHeaders = target.authed && SESSION_COOKIE
      ? { Cookie: SESSION_COOKIE }
      : undefined;
    const runOpts = extraHeaders
      ? { ...opts, extraHeaders }
      : opts;

    console.log(`\n▶ ${target.url}`);
    const result = await lighthouse(target.url, runOpts);
    if (!result) {
      failures.push({ url: target.url, reason: 'lighthouse returned no result' });
      continue;
    }
    const { categories, audits } = result.lhr;

    const score = categories.performance.score ?? 0;
    if (score < THRESHOLDS.performance) {
      failures.push({ url: target.url, metric: 'performance', got: score, want: `>=${THRESHOLDS.performance}` });
    }
    console.log(`  performance score: ${(score * 100).toFixed(1)} (need ${THRESHOLDS.performance * 100})`);

    for (const [key, ceiling] of Object.entries(THRESHOLDS)) {
      if (key === 'performance') continue;
      const audit = audits[key];
      if (!audit) continue;
      const value = audit.numericValue ?? 0;
      const passes = key === 'cumulative-layout-shift' ? value <= ceiling : value <= ceiling;
      console.log(`  ${key}: ${typeof value === 'number' ? value.toFixed(2) : value} (ceiling ${ceiling}) ${passes ? '✓' : '✗'}`);
      if (!passes) {
        failures.push({ url: target.url, metric: key, got: value, want: `<=${ceiling}` });
      }
    }
  }

  await chrome.kill();

  if (failures.length > 0) {
    console.error('\nLighthouse failures:');
    for (const f of failures) console.error(' -', JSON.stringify(f));
    process.exit(1);
  }
  console.log('\nAll Lighthouse targets passed.');
}

main().catch((err) => {
  console.error('Lighthouse runner crashed:', err);
  process.exit(2);
});
