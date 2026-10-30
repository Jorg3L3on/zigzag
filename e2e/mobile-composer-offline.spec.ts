import { expect, test, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  openComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I35 on a phone: a full ticket (two services and a material) saved with
 * no signal, shown pending with no folio, then synced once with its real
 * folio. A document the server refuses turns into Revisar and keeps its data.
 * Writes data: run against a local or disposable database only.
 */

const pendingRows = (page: Page) =>
  page.getByTestId('pending-documents').filter({ visible: true }).getByTestId('pending-document-row');

/** Blocks Server Actions so a pending document stays pending while we look at it. */
const holdServerActions = async (page: Page) => {
  await page.route('**/*', async (route) => {
    if (route.request().headers()['next-action']) {
      await route.abort();
      return;
    }
    await route.continue();
  });
};

/** Point the first line of every queued document at a service that does not exist. */
const breakQueuedDocuments = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('zigzag-field');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['localJobs', 'outbox'], 'readwrite');
          for (const name of ['localJobs', 'outbox']) {
            const store = tx.objectStore(name);
            const all = store.getAll();
            all.onsuccess = () => {
              for (const row of all.result as Array<{
                payload: { composer?: { lines: Array<{ service_id: number | null }> } };
              }>) {
                if (row.payload.composer) {
                  row.payload.composer.lines[0].service_id = 2_000_000_000;
                  store.put(row);
                }
              }
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

const buildOfflineTicket = async (page: Page, context: import('@playwright/test').BrowserContext) => {
  const suffix = Date.now();
  await openComposer(page);
  await createClientInComposer(page, {
    name: `Sin señal ${suffix}`,
    phone: `55${String(suffix).slice(-8)}`,
  });

  await context.setOffline(true);
  await expect(page.getByTestId('composer-offline-notice')).toBeVisible({ timeout: 10_000 });

  await addComposerLine(page, { quantity: 1, price: 500 }, 0);
  await addComposerLine(page, { quantity: 2, price: 150 }, 1);

  // An inline material under the first service.
  const lines = page.getByRole('list', { name: 'Servicios del ticket' });
  await lines.getByTestId('composer-line-row').first().click();
  const sheet = page.getByRole('dialog', { name: 'Editar servicio' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Agregar material' }).click();
  const step = page.getByRole('dialog', { name: 'Agregar material' });
  await step.getByRole('radio', { name: 'Escribir' }).click();
  await step.getByLabel('Nombre del material').fill(`Cinta ${suffix}`);
  await step.getByRole('button', { name: 'pza', exact: true }).click();
  await step.getByLabel(/^Precio/).fill('40');
  await step.getByRole('button', { name: 'Agregar material' }).click();
  await sheet.getByRole('button', { name: 'Agregar al ticket' }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('composer-offline-saved')).toBeVisible({ timeout: 15_000 });
  return { clientName: `Sin señal ${suffix}` };
};

test.describe('Composer with no signal (ZIG-I35)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Phone flow');
    await login(page);
    await ensureTenantCompany(page);
  });

  test('saves offline, shows it pending without folio, then syncs once with the real folio', async ({
    page,
    context,
  }) => {
    const { clientName } = await buildOfflineTicket(page, context);

    // Back online, but hold the upload to see the pending state on the list.
    await context.setOffline(false);
    await holdServerActions(page);
    await page.goto('/tickets');
    const row = pendingRows(page).filter({ hasText: clientName });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText('Pendiente de sincronizar');
    await expect(row).toContainText('Sin folio todavía · no es factura');
    await expect(row).toContainText('$1,340.00');
    await page.screenshot({ path: test.info().outputPath('pending.png'), fullPage: true });

    await page.unroute('**/*');
    await page
      .getByTestId('pending-documents')
      .filter({ visible: true })
      .getByRole('button', { name: 'Subir ahora' })
      .click();
    const synced = page.getByText(/^Ticket R-\d+ sincronizado$/);
    await expect(synced).toBeVisible({ timeout: 30_000 });
    const folio = (await synced.textContent())?.match(/R-\d+/)?.[0];
    await expect(pendingRows(page)).toHaveCount(0);

    // One ticket with that folio, total with the material.
    await page.goto('/tickets');
    await page.getByRole('searchbox').first().fill(clientName);
    const card = page.getByText(clientName).filter({ visible: true });
    await expect(card).toHaveCount(1, { timeout: 30_000 });
    expect(folio).toBeTruthy();
    await expect(page.getByText(folio!).filter({ visible: true }).first()).toBeVisible();
  });

  test('a refused document turns into Revisar with the reason, Reintentar keeps it, Descartar removes it', async ({
    page,
    context,
  }) => {
    const { clientName } = await buildOfflineTicket(page, context);
    await breakQueuedDocuments(page);

    await context.setOffline(false);
    await page.goto('/tickets');
    const row = pendingRows(page).filter({ hasText: clientName });
    await expect(row).toContainText('Revisar', { timeout: 30_000 });
    await expect(row).toContainText(/servicio ya no está disponible/);
    await page.screenshot({ path: test.info().outputPath('revisar.png'), fullPage: true });

    await row.getByRole('button', { name: 'Reintentar' }).click();
    await expect(row).toContainText(/servicio ya no está disponible/, { timeout: 30_000 });
    await expect(row.getByRole('link', { name: 'Revisar' })).toHaveAttribute(
      'href',
      /\/tickets\/create\?pendiente=/,
    );

    await row.getByRole('button', { name: 'Descartar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
    await expect(pendingRows(page).filter({ hasText: clientName })).toHaveCount(0);
  });
});
