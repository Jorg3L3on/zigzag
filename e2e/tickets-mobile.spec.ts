import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  expectStickyActionAboveDock,
  visibleMobileAppBar,
  visiblePageHeader,
} from './helpers/mobile-chrome';
import {
  addComposerLine,
  createClientInComposer,
  finishOnReview,
  openComposer,
  saveComposer,
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
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir filtros/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toBeVisible();
    await expect(page.getByText(/de \d+ tickets/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('search keeps focus and the full value while results reload', async ({
    page,
  }) => {
    await page.goto('/tickets');
    const search = page.getByPlaceholder('Buscar tickets...');
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
    await expect(
      page.getByRole('button', { name: 'Guardar ticket' }).first(),
    ).toBeDisabled();
    // No wizard copy and nothing says Crear before saving (the dock's + is labelled Crear).
    await expect(page.getByText(/Paso \d de \d/)).toHaveCount(0);
    await expect(
      page
        .getByRole('button', { name: 'Crear', exact: true })
        .and(page.locator(':not([data-testid="mobile-dock-create"])')),
    ).toHaveCount(0);
    // The dock stays; the sticky CTA floats above it.
    await expectStickyActionAboveDock(page);
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
    await expect(page.getByRole('combobox', { name: 'Cliente' })).toContainText(
      clientName,
      { timeout: 15_000 },
    );
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
    const ticketId = await saveComposer(page);
    expect(Number(ticketId)).toBeGreaterThan(0);

    // Creation review: summary, pago and recibo; none of the detail-page noise.
    await expect(
      page.getByRole('heading', { name: `Ticket #${ticketId} guardado` }),
    ).toBeVisible();
    await expect(page.getByTestId('review-total')).toHaveText('$12,950.00');
    await expect(page.getByRole('radio', { name: /Pago parcial/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Pendiente/ })).toBeVisible();
    await expect(page.getByTestId('recibo-summary')).toBeVisible();
    await expect(page.getByRole('button', { name: /Descargar PDF/ })).toBeVisible();
    for (const noise of ['Creado', 'Actualizado', 'Actividad']) {
      await expect(page.getByText(noise, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Más acciones del ticket' })).toHaveCount(0);

    const openedUrls = await finishOnReview(page, ticketId, { mode: 'full' });
    // Headless Chromium has no file share: falls back to WhatsApp with the recibo text.
    expect(openedUrls.some((url) => url.startsWith('https://wa.me/'))).toBe(true);
    // Headless Chromium has no inline PDF viewer: the recibo summary + Abrir PDF show instead.
    await expect(page.getByTestId('recibo-summary')).toBeVisible();
    await expect(page.getByRole('link', { name: /Abrir PDF/ })).toHaveAttribute(
      'href',
      `/tickets/${ticketId}/recibo?from=listo`,
    );

    // ZIG-I9: Abrir PDF stays inside the app and back returns to the review.
    await page.getByRole('link', { name: /Abrir PDF/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}/recibo\\?from=listo$`));
    await expect(page.getByTestId('mobile-app-bar')).toContainText(`Recibo #${ticketId}`);
    await page.getByRole('link', { name: 'Volver al resumen del ticket' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}/listo$`));
    await expect(page.getByTestId('recibo-summary')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /Descargar PDF/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    await page.goto('/tickets');
    await expect(page.getByText(clientName).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
