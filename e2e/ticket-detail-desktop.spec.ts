import { test, expect, type Locator, type Page } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import {
  addCustomComposerLine,
  createClientInComposer,
  finishOnDetail,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I27-5: on desktop the right column is the money side. En proceso it holds the
 * finish panel, finished it holds Pagos; Actividad is one folded copy at the end of the
 * main column. Saves data: scratch DB or CI.
 */
const visible = (locator: Locator) => locator.filter({ visible: true }).first();

const columnOf = async (page: Page, locator: Locator) => {
  const asideBox = await page.locator('main aside[aria-label="Cobro del ticket"]').boundingBox();
  const box = await locator.boundingBox();
  expect(box, 'element is rendered').not.toBeNull();
  if (!asideBox || asideBox.width === 0) return 'main';
  return box!.x >= asideBox.x - 1 ? 'aside' : 'main';
};

const expectActivityFoldedLast = async (page: Page) => {
  const activity = page.getByRole('button', { name: /^Actividad/ });
  await expect(activity).toHaveCount(1);
  await expect(activity).toHaveAttribute('aria-expanded', 'false');
  expect(await columnOf(page, activity)).toBe('main');
  const services = visible(page.getByRole('heading', { name: /^Servicios/ }));
  expect((await activity.boundingBox())!.y).toBeGreaterThan((await services.boundingBox())!.y);
  await activity.click();
  await expect(activity).toHaveAttribute('aria-expanded', 'true');
};

test.describe('Ticket detail desktop columns @1280px (ZIG-I27-5)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('finish panel on the right while En proceso, Pagos on the right once finished', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-8);
    await openComposer(page);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await createClientInComposer(page, { name: `Cliente columnas ${suffix}`, phone: `987${suffix.slice(-7)}` });
    await addCustomComposerLine(page, { name: 'Mantenimiento preventivo', quantity: '1', price: '1500' });
    await saveComposer(page);
    const ticketId = page.url().match(/\/tickets\/(\d+)/)![1];

    // En proceso: Terminar ticket on the right, no Pagos anywhere, Actividad folded at the end.
    const finish = visible(page.locator('#finalizar'));
    await expect(finish).toBeVisible({ timeout: 15_000 });
    expect(await columnOf(page, finish)).toBe('aside');
    await expect(page.getByRole('heading', { name: /^Pagos/ }).filter({ visible: true })).toHaveCount(0);
    await expectActivityFoldedLast(page);

    // Finishing from the right column lands on Pagos in the same place.
    await page.reload();
    await finishOnDetail(page, ticketId, { mode: 'partial', amount: 500 });
    await page.goto(`/tickets/${ticketId}`);
    const pagos = visible(page.getByRole('heading', { name: /^Pagos/ }));
    await expect(pagos).toBeVisible({ timeout: 15_000 });
    await expect(pagos).toContainText('1');
    expect(await columnOf(page, pagos)).toBe('aside');
    await expect(page.getByRole('heading', { name: /^Pagos/ }).filter({ visible: true })).toHaveCount(1);
    await expect(page.locator('#finalizar').filter({ visible: true })).toHaveCount(0);
    await expectActivityFoldedLast(page);
  });
});
