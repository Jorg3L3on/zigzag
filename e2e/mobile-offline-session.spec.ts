import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { e2eCredentialsSkipReason, hasE2eCredentials, login, loginAs } from './helpers/auth';
import { addComposerLine, createClientInComposer, openComposer } from './helpers/ticket-composer';

/**
 * ZIG-I36-6 group 2: offline and session on a phone.
 *  - ZIG-I36-15  Hoy does not bounce to "sesión expirada" when the server cannot be asked
 *  - ZIG-I36-20  Guardar with a closed session says so and keeps the ticket
 *  - ZIG-I36-21  a ticket queued for company A never uploads under company B
 *  - ZIG-I36-23  the phone is prepared right after sign-in, with a banner
 * Needs a local copy with the audit seed (tecnico@ of Auditoría Normal as E2E_EMAIL,
 * tecnico@ of Auditoría Pesada as the other company). Writes data: disposable DB only.
 */

const OTHER_COMPANY_EMAIL = process.env.E2E_OTHER_EMAIL ?? 'tecnico@auditoria-pesada.test';

const saveOfflineTicket = async (page: Page, context: BrowserContext, label: string) => {
  const suffix = Date.now();
  await openComposer(page);
  await createClientInComposer(page, { name: `${label} ${suffix}`, phone: `55${String(suffix).slice(-8)}` });
  await context.setOffline(true);
  await expect(page.getByTestId('composer-offline-notice')).toBeVisible({ timeout: 10_000 });
  await addComposerLine(page, { quantity: 1, price: 500 }, 0);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('composer-offline-saved')).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
  return `${label} ${suffix}`;
};

test.describe('Offline and session (ZIG-I36-6 group 2)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Phone flow');
  });

  test('ZIG-I36-15: Hoy stays when the session cannot be checked', async ({ page }) => {
    await login(page);
    await page.route('**/api/auth/session', (route) => route.abort());
    await page.goto('/dashboard');
    await page.waitForTimeout(4000);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/Sesión expirada/i)).toHaveCount(0);
  });

  test('ZIG-I36-15: a closed session still goes to sign in', async ({ page, context }) => {
    await login(page);
    await context.clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?reason=expired/, { timeout: 15_000 });
    await expect(page.getByText(/sesión (expiró|expirada)/i).first()).toBeVisible();
  });

  test('ZIG-I36-20: Guardar with a closed session says so, keeps the ticket, offers Entrar', async ({
    page,
    context,
  }) => {
    await login(page);
    const suffix = Date.now();
    await openComposer(page);
    await createClientInComposer(page, { name: `Sesión ${suffix}`, phone: `55${String(suffix).slice(-8)}` });
    await addComposerLine(page, { quantity: 1, price: 300 }, 0);

    await context.clearCookies();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    const notice = page.getByTestId('composer-session-closed');
    await expect(notice).toBeVisible({ timeout: 20_000 });
    await expect(notice).toContainText('Tu sesión se cerró.');
    await expect(notice).toContainText('Entra de nuevo; tu ticket se queda guardado en este teléfono.');
    await expect(page.getByText(/guardado sin conexión/i)).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('session-closed.png'), fullPage: true });

    await notice.getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login\?reason=expired&callbackUrl=%2Ftickets%3Fpendientes%3D1/);
  });

  test('ZIG-I36-21: a ticket of company A waits, kept, under company B and uploads for A', async ({
    page,
    context,
  }) => {
    await login(page);
    const clientName = await saveOfflineTicket(page, context, 'Empresa A');

    // Company B signs in on the same phone: nothing of A uploads, nothing turns into Revisar.
    await loginAs(page, OTHER_COMPANY_EMAIL, process.env.E2E_PASSWORD!);
    await page.goto('/tickets?pendientes=1');
    const other = page.getByTestId('pending-other-company').filter({ visible: true });
    await expect(other).toContainText(clientName, { timeout: 30_000 });
    await expect(other).toContainText('Guardado para Auditoría Normal. Se envía cuando entres con esa empresa.');
    await page.waitForTimeout(3000);
    await expect(page.getByText(/necesita revisión|ya no está disponible/)).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('other-company.png'), fullPage: true });

    // Company A is back: the same ticket is still pending, has no false error, and syncs.
    await login(page);
    await page.goto('/tickets?pendientes=1');
    const row = page
      .getByTestId('pending-documents')
      .filter({ visible: true })
      .getByTestId('pending-document-row')
      .filter({ hasText: clientName });
    await expect(row).not.toContainText(/ya no está disponible/);
    await expect(page.getByText(/^Ticket R-\d+ sincronizado$/)).toBeVisible({ timeout: 30_000 });
    // M-23: the list refreshes behind the toast; the pending row is gone.
    await expect(page.getByText('Ya tiene su folio.')).toBeVisible();
    await expect(row).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('synced.png'), fullPage: true });
  });

  test('ZIG-I36-23: right after sign-in the phone is prepared and says so', async ({ page }) => {
    // Hold the catalog calls so the banner can be seen.
    await page.route('**/*', async (route) => {
      if (route.request().headers()['next-action']) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    await login(page);
    const banner = page.getByTestId('offline-preparation');
    await expect(banner).toContainText('Preparando para trabajar sin señal…', { timeout: 15_000 });
    await page.screenshot({ path: test.info().outputPath('preparing.png') });
    await expect(banner).toContainText('Listo para trabajar sin señal', { timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('ready.png') });
    await expect(banner).toBeHidden({ timeout: 10_000 });
    const flag = await page.evaluate(() => localStorage.getItem('zigzag:offline-ready:v1'));
    expect(flag).toBeTruthy();
  });
});
