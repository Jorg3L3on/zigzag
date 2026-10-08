import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { visibleMobileAppBar, visiblePageHeader } from './helpers/mobile-chrome';
import {
  addComposerLine,
  createClientInComposer,
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
    // No wizard copy and nothing says Crear before saving.
    await expect(page.getByText(/Paso \d de \d/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Crear', exact: true })).toHaveCount(0);
    // Sticky CTA replaces the dock on this screen.
    await expect(page.getByTestId('mobile-bottom-tab-bar')).toHaveCount(0);
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

    await page.goto('/tickets');
    await expect(page.getByText(clientName).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
