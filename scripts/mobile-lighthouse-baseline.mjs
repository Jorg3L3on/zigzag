#!/usr/bin/env node
/**
 * Run Lighthouse mobile baselines for ZigZag critical paths.
 * Requires: prod server (default http://127.0.0.1:3070), E2E_EMAIL/E2E_PASSWORD in .env
 *
 * Usage:
 *   npm run build && npm run start -- -p 3070   # separate terminal
 *   node scripts/mobile-lighthouse-baseline.mjs
 */
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';

dotenv.config();

const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:3070';
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

const paths = [
  { path: '/login', auth: false },
  { path: '/dashboard', auth: true },
  { path: '/tickets', auth: true },
];

const formatMs = (value) => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value / 1000).toFixed(1)} s`;
};

const runLighthouse = (url, cookieHeader) => {
  const extraHeaders = cookieHeader
    ? JSON.stringify({ Cookie: cookieHeader })
    : undefined;

  const args = [
    url,
    '--form-factor=mobile',
    '--screenEmulation.mobile',
    '--throttling-method=simulate',
    '--quiet',
    '--output=json',
    '--output-path=stdout',
    '--chrome-flags=--headless=new',
  ];

  if (extraHeaders) {
    args.push('--extra-headers', extraHeaders);
  }

  const result = spawnSync('npx', ['lighthouse', ...args], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(
      `Lighthouse failed for ${url}: ${result.stderr || result.stdout}`,
    );
  }

  return JSON.parse(result.stdout);
};

const getSessionCookieHeader = async () => {
  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD in .env for authenticated runs.');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  const cookies = await context.cookies();
  await browser.close();

  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
};

const extractMetrics = (report) => {
  const audits = report.audits ?? {};
  const categories = report.categories ?? {};

  return {
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    lcp: audits['largest-contentful-paint']?.numericValue,
    tbt: audits['total-blocking-time']?.numericValue,
    cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
  };
};

const main = async () => {
  console.log(`Lighthouse mobile baseline — ${baseUrl}\n`);

  const cookieHeader = await getSessionCookieHeader();
  const rows = [];

  for (const { path, auth } of paths) {
    const url = `${baseUrl}${path}`;
    process.stdout.write(`Running ${path}… `);

    const report = runLighthouse(url, auth ? cookieHeader : undefined);
    const metrics = extractMetrics(report);

    console.log(`Performance ${metrics.performance}`);
    rows.push({ path, ...metrics });
  }

  console.log('\n| Path | Performance | LCP | TBT | CLS |');
  console.log('|------|-------------|-----|-----|-----|');
  for (const row of rows) {
    console.log(
      `| ${row.path} | ${row.performance} | ${formatMs(row.lcp)} | ${row.tbt != null ? `${Math.round(row.tbt)} ms` : '—'} | ${row.cls} |`,
    );
  }
};

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
