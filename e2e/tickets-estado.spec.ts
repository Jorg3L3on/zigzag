import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Tickets list Estado column', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows compact payment status with bar and no visible percent', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 15_000 });
    await expect(
      table.getByRole('columnheader', { name: /Estado/i }),
    ).toBeVisible();

    const summaries = table.getByTestId('ticket-payment-summary');
    await expect(summaries.first()).toBeVisible({ timeout: 15_000 });
    const count = await summaries.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const summary = summaries.nth(i);
      const status = await summary.getAttribute('data-payment-status');
      expect(['paid', 'partial', 'pending']).toContain(status);

      await expect(summary.getByRole('progressbar')).toBeVisible();
      await expect(summary.getByText(/\b\d+%/)).toHaveCount(0);
      await expect(summary.getByText(/\bde\b/)).toBeVisible();
    }

    const partial = table.locator(
      '[data-testid="ticket-payment-summary"][data-payment-status="partial"]',
    );
    const pending = table.locator(
      '[data-testid="ticket-payment-summary"][data-payment-status="pending"]',
    );
    const paid = table.locator(
      '[data-testid="ticket-payment-summary"][data-payment-status="paid"]',
    );

    // Prefer asserting against whatever statuses exist in seed data.
    if ((await partial.count()) > 0) {
      const cell = partial.first();
      await expect(cell.getByText('Pago parcial')).toBeVisible();
      const bar = cell.getByRole('progressbar');
      const value = Number(await bar.getAttribute('aria-valuenow'));
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(100);
    }

    if ((await pending.count()) > 0) {
      const cell = pending.first();
      await expect(cell.getByText('Pendiente')).toBeVisible();
      await expect(cell.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '0',
      );
    }

    if ((await paid.count()) > 0) {
      const cell = paid.first();
      await expect(cell.getByText('Saldado')).toBeVisible();
      await expect(cell.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '100',
      );
    }
  });

  test('mobile cards reuse the same payment summary without percent text', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    const summaries = page.getByTestId('ticket-payment-summary');
    await expect(summaries.first()).toBeVisible({ timeout: 15_000 });
    await expect(summaries.first().getByRole('progressbar')).toBeVisible();
    await expect(summaries.first().getByText(/\b\d+%/)).toHaveCount(0);
    await expect(summaries.first().getByText(/\bde\b/)).toBeVisible();
  });
});
