import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  expectStickyActionReplacesDock,
  visibleMobileAppBar,
  visiblePageHeader,
} from './helpers/mobile-chrome';
import {
  addComposerLine,
  createClientInComposer,
  saveAndFinishComposer,
  openComposer,
} from './helpers/ticket-composer';

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

test.describe('Mobile ticket screens', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows mobile-first tickets list controls', async ({ page }) => {
    await page.goto('/tickets');

    await expect(visiblePageHeader(page).getByText('Tickets')).toBeVisible();
    await expect(page.getByPlaceholder('Cliente, número de ticket o teléfono')).toBeVisible();
    await expect(page.getByRole('button', { name: /Más filtros/ })).toBeVisible();
    // Nuevo ticket lives in the dock's + on phones; the list shows the cobro chips (ZIG-I13-7).
    await expect(page.getByRole('group', { name: 'Filtro de cobro' })).toBeVisible();
    // No Por cobrar total (ZIG-I27-3).
    await expect(page.getByTestId('tickets-balance-due')).toHaveCount(0);
    await expect(page.getByText(/de \d+ tickets/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('search keeps focus and the full value while results reload', async ({
    page,
  }) => {
    await page.goto('/tickets');
    const search = page.getByPlaceholder('Cliente, número de ticket o teléfono');
    await expect(search).toBeVisible();
    const firstCard = page
      .getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ })
      .first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const clientName = (await firstCard.locator('p').first().innerText()).trim();
    const word = clientName.slice(0, 6);
    test.skip(word.length < 4, 'first ticket client name is too short to type');

    await search.click();
    await page.keyboard.type(word, { delay: 80 });
    // Let the 300 ms debounce fire and the reload finish.
    await page.waitForTimeout(600);
    await expect(page.getByText(`Búsqueda: ${word.trim()}`)).toBeVisible();

    await expect(search).toBeFocused();
    await expect(search).toHaveValue(word);
  });

  test('shows the single-screen Nuevo ticket composer', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/tickets/create');

    await expect(visibleMobileAppBar(page).getByText('Nuevo ticket')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Servicios', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo cliente' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar servicio' })).toBeVisible();
    await expect(page.getByTestId('composer-total')).toHaveText('$0.00');
    // Guardar stays tappable; the hint names what is missing (ZIG-I18-13).
    await expect(
      page.getByRole('button', { name: /^Guardar( ticket)?$/ }).first(),
    ).toBeEnabled();
    await expect(page.getByTestId('composer-sticky-hint')).toHaveText('Elige un cliente');
    // No wizard copy and nothing says Crear before saving (the dock's + is labelled Crear).
    await expect(page.getByText(/Paso \d de \d/)).toHaveCount(0);
    await expect(
      page
        .getByRole('button', { name: 'Crear', exact: true })
        .and(page.locator(':not([data-testid="mobile-dock-create"])')),
    ).toHaveCount(0);
    // The dock stays; the sticky CTA floats above it.
    await expectStickyActionReplacesDock(page);
    await expectNoHorizontalOverflow(page);
    expect(
      consoleErrors.filter((text) => /hydrat/i.test(text)),
    ).toEqual([]);
  });

  test('creates a ticket with two lines in one save; the draft survives a reload', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const suffix = Date.now().toString().slice(-8);
    const clientName = `Composer E2E ${suffix}`;

    await page.goto('/tickets');
    const countText = async () =>
      (await page.getByText(/de \d+ tickets/).first().textContent()) ?? '';
    await expect(page.getByText(/de \d+ tickets/).first()).toBeVisible({
      timeout: 15_000,
    });
    const before = await countText();

    await openComposer(page);
    await createClientInComposer(page, {
      name: clientName,
      phone: `962${suffix.slice(-7)}`,
    });
    await addComposerLine(page, { quantity: 3, price: 4200 });
    await addComposerLine(page, { quantity: 1, price: 350 }, 1);
    await expect(page.getByTestId('composer-total')).toHaveText('$12,950.00');

    // Draft survives a reload (client, lines).
    await page.reload();
    await expect(page.getByTestId('composer-party-card')).toContainText(clientName, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('composer-total')).toHaveText('$12,950.00');

    // Nothing was persisted before Guardar ticket.
    await page.goto('/tickets');
    await expect(page.getByText(/de \d+ tickets/).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(await countText()).toBe(before);
    await expect(page.getByText(clientName)).toHaveCount(0);

    await page.goto('/tickets/create');
    await expect(page.getByTestId('composer-total')).toHaveText('$12,950.00', {
      timeout: 15_000,
    });
    // Guardar y terminar from the composer (ZIG-I24-4): no review screen in between.
    const { ticketId, openedUrls } = await saveAndFinishComposer(page, { mode: 'full' });
    expect(Number(ticketId)).toBeGreaterThan(0);
    // Headless Chromium has no file share: falls back to WhatsApp with the recibo text.
    expect(openedUrls.some((url) => url.startsWith('https://wa.me/'))).toBe(true);
    await expect(
      page.getByTestId('ticket-status-pill').filter({ visible: true }).first(),
    ).toHaveText('Pagado', { timeout: 15_000 });

    // ZIG-I9: the recibo opens inside the app and back returns to the ticket.
    await page.goto(`/tickets/${ticketId}/recibo`);
    await expect(
      page.getByTestId('mobile-app-bar').filter({ visible: true }).first(),
    ).toContainText(/Recibo (?:#\d+|[A-Z0-9]+-\d+)/);
    await page.getByRole('link', { name: 'Volver al ticket' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));

    await page.getByRole('button', { name: 'Más acciones del ticket' }).filter({ visible: true }).first().click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('menuitem', { name: 'Descargar PDF' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    await page.goto('/tickets');
    await expect(page.getByText(clientName).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
