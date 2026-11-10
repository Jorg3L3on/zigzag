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
 * finish panel, finished it holds Pagos; Actividad is one card in that column (ZIG-I28-7).
 * Saves data: scratch DB or CI.
 */
const visible = (locator: Locator) => locator.filter({ visible: true }).first();

const columnOf = async (page: Page, locator: Locator) => {
  const asideBox = await page.locator('main aside[data-testid="ticket-detail-money-column"]').boundingBox();
  const box = await locator.boundingBox();
  expect(box, 'element is rendered').not.toBeNull();
  if (!asideBox || asideBox.width === 0) return 'main';
  return box!.x >= asideBox.x - 1 ? 'aside' : 'main';
};

/**
 * One Actividad on desktop (canvas): the card in the right column, whose Ver todo
 * opens the rest in place. The folded timeline at the end stays for phones only.
 */
const expectOneActivityCard = async (page: Page) => {
  const card = visible(page.getByTestId('ticket-activity-card'));
  await expect(card).toBeVisible();
  expect(await columnOf(page, card)).toBe('aside');
  await expect(page.getByRole('button', { name: /^Actividad/ }).filter({ visible: true })).toHaveCount(0);
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

    // En proceso: Terminar ticket on the right, no Pagos anywhere, one Actividad card on the right.
    const finish = visible(page.locator('#finalizar'));
    await expect(finish).toBeVisible({ timeout: 15_000 });
    expect(await columnOf(page, finish)).toBe('aside');
    await expect(page.getByRole('heading', { name: /^Pagos/ }).filter({ visible: true })).toHaveCount(0);
    await expectOneActivityCard(page);

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
    await expectOneActivityCard(page);
  });
});

/**
 * ZIG-I37-3 / ZIG-I37-4, read only: opens an existing ticket (E2E_TICKET_DETAIL_ID, or the
 * first one in the list) and checks the layout. Saves nothing.
 */
const openSomeTicket = async (page: Page) => {
  const id = process.env.E2E_TICKET_DETAIL_ID;
  if (id) {
    await page.goto(`/tickets/${id}`);
  } else {
    await page.goto('/tickets');
    const row = page.getByTestId('tickets-row').filter({ visible: true }).first();
    const hasRow = await row
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasRow, 'no ticket in this tenant');
    await row.click();
    await page.waitForURL(/\/tickets\/\d+$/, { timeout: 30_000 });
  }
  await expect(page.getByTestId('ticket-detail-title').filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
};

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b, 'element is rendered').not.toBeNull();
  return b!;
};

const setSidebar = async (page: Page, baseURL: string | undefined, open: boolean) => {
  const url = new URL(baseURL ?? 'http://localhost:3000');
  await page.context().addCookies([
    { name: 'sidebar_state', value: String(open), domain: url.hostname, path: '/' },
  ]);
};

test.describe('Ticket detail layout, read only (ZIG-I37-3, ZIG-I37-4)', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('1024 with the sidebar open: Actividad closes the page, buttons stay under the meta', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await setSidebar(page, baseURL, true);
    await openSomeTicket(page);

    const activity = page.getByTestId('ticket-activity-card');
    await expect(activity.filter({ visible: true })).toHaveCount(1);
    const services = await box(visible(page.locator('main [aria-labelledby="ticket-document-heading"]')));
    const activityBox = await box(visible(activity));
    expect(activityBox.y).toBeGreaterThanOrEqual(services.y + services.height - 1);
    // One column here, so x says nothing: the shown card is outside the aside.
    expect(await visible(activity).evaluate((el) => el.closest('aside') === null)).toBe(true);
    // One Actividad heading in the accessibility tree.
    await expect(page.getByRole('heading', { name: /^Actividad/ })).toHaveCount(1);
    await expect(
      page.getByRole('complementary', { name: /actividad/i }),
      'the aside does not claim Actividad here',
    ).toHaveCount(0);

    const title = await box(visible(page.getByTestId('ticket-detail-title')));
    const actions = page.getByTestId('ticket-detail-header-actions').filter({ visible: true });
    if (await actions.count()) {
      expect((await box(actions.first())).y).toBeGreaterThan(title.y + title.height - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('1440 with the sidebar folded: buttons right of the title, top-aligned, one row; Actividad in the aside', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setSidebar(page, baseURL, false);
    await openSomeTicket(page);

    const activity = visible(page.getByTestId('ticket-activity-card'));
    expect(await columnOf(page, activity)).toBe('aside');
    await expect(page.getByRole('heading', { name: /^Actividad/ })).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: /, cliente y actividad$/ })).toHaveCount(1);

    const actions = page.getByTestId('ticket-detail-header-actions').filter({ visible: true });
    test.skip((await actions.count()) === 0, 'no header actions for this user');
    const actionsBox = await box(actions.first());
    const title = await box(visible(page.getByTestId('ticket-detail-title')));
    const header = await box(visible(page.getByTestId('ticket-detail-header')));
    expect(actionsBox.x).toBeGreaterThanOrEqual(title.x + title.width - 1);
    expect(Math.abs(actionsBox.y - header.y)).toBeLessThanOrEqual(4);
    // One row: every button shares the first one's top.
    const tops = await actions
      .first()
      .locator(':scope > :is(a, button)')
      .filter({ visible: true })
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const heights = await actions
      .first()
      .locator(':scope > :is(a, button)')
      .filter({ visible: true })
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
    expect(heights.every((h) => h === 40)).toBe(true);
  });
});
