/**
 * Install screenshots for the web app manifest (ZIG-I21-4): three phone shots
 * (form_factor narrow, shown by Chrome on Android in the install sheet) and one
 * desktop shot (wide). Read-only: it signs in and takes pictures, nothing else.
 *
 * Point it at a running build whose database has the demo tenant (ClimaTotal
 * Demo) and sign in with a user of that tenant, never a real customer's:
 *
 *   SCREENSHOTS_BASE_URL=http://127.0.0.1:3074 \
 *   SCREENSHOTS_EMAIL=... SCREENSHOTS_PASSWORD=... \
 *   node scripts/capture-manifest-screenshots.mjs
 *
 * Sizes must match src/lib/manifest-screenshots.ts (checked by manifest.test).
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'screenshots');

const baseUrl = process.env.SCREENSHOTS_BASE_URL;
const email = process.env.SCREENSHOTS_EMAIL;
const password = process.env.SCREENSHOTS_PASSWORD;

/** Pixel 7 CSS viewport at 2x: 824x1830, within Chrome's 2.3:1 limit. */
const PHONE = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const NARROW_SHOTS = [
  { file: 'narrow-dashboard.webp', path: '/dashboard' },
  { file: 'narrow-tickets.webp', path: '/tickets' },
  { file: 'narrow-recordatorios.webp', path: '/service-schedules' },
];
const WIDE_SHOTS = [{ file: 'wide-dashboard.webp', path: '/dashboard' }];

const login = async (page) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null, null, {
      timeout: 15_000,
    })
    .catch(() => undefined);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
};

const capture = async (page, shot) => {
  await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  const png = await page.screenshot({ fullPage: false });
  const destination = path.join(outDir, shot.file);
  await sharp(png).webp({ quality: 82 }).toFile(destination);
  console.log(`wrote ${path.relative(root, destination)}`);
};

const run = async (browser, device, shots) => {
  const context = await browser.newContext({
    ...device,
    locale: 'es-MX',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await login(page);
    for (const shot of shots) {
      await capture(page, shot);
    }
  } finally {
    await context.close();
  }
};

const main = async () => {
  if (!baseUrl || !email || !password) {
    console.error('Set SCREENSHOTS_BASE_URL, SCREENSHOTS_EMAIL and SCREENSHOTS_PASSWORD.');
    process.exitCode = 1;
    return;
  }
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    await run(browser, PHONE, NARROW_SHOTS);
    await run(browser, DESKTOP, WIDE_SHOTS);
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
