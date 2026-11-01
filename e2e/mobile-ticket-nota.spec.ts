import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  finishOnDetail,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I36-16 (M-02), M-18, M-25, M-30: the note written in the composer shows under
 * "Nota" on the phone detail and on the recibo screen; the composer hints that a line
 * can be tapped and its edit button reads Guardar cambios; a paid ticket says Pagado
 * once. Saves data: scratch DB or CI.
 */
test.describe('Nota del ticket en el teléfono', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('detail and recibo show the note; paid hero says Pagado once', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-8);
    const note = `Revisar la fuga en 15 días ${suffix}. Cliente pide factura.`;

    await openComposer(page);
    await createClientInComposer(page, { name: `Cliente nota ${suffix}`, phone: `995${suffix.slice(-7)}` });
    await addComposerLine(page, { quantity: 1, price: 500 });

    await expect(page.getByTestId('composer-lines-hint')).toHaveText(
      'Toca una línea para cambiarla o quitarla',
    );
    await page.getByTestId('composer-line-row').first().click();
    const sheet = page.getByRole('dialog', { name: 'Editar servicio' });
    await expect(sheet.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(sheet).toBeHidden();

    await page.getByLabel(/^Notas/).fill(note);
    const ticketId = await saveComposer(page);

    await expect(page.getByRole('heading', { name: 'Nota' })).toBeVisible();
    await expect(page.getByTestId('ticket-phone-note')).toHaveText(note);

    await finishOnDetail(page, ticketId, { mode: 'full' });
    await page.goto(`/tickets/${ticketId}`);
    const hero = page.getByTestId('ticket-hero');
    await expect(hero.getByText('Pagado', { exact: true })).toHaveCount(1);
    await expect(page.getByTestId('ticket-phone-note')).toHaveText(note);

    await page.goto(`/tickets/${ticketId}/recibo`);
    await expect(page.getByTestId('recibo-note')).toHaveText(note);
  });
});
