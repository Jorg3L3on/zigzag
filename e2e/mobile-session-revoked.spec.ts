import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import {
  e2eViewerEmail,
  e2eViewerPassword,
  hasE2eViewerCredentials,
  e2eViewerCredentialsSkipReason,
  loginAs,
} from './helpers/auth';

/**
 * ZIG-I17-9: a session revoked from elsewhere (sign out everywhere, a password
 * change) must land on the login form, not bounce between /login and the app.
 * Uses the viewer account, and bumps its token_version directly, which is what
 * "Cerrar sesión en todos mis dispositivos" does.
 */
test.describe('Revoked session', () => {
  test.beforeEach(() => {
    test.skip(!hasE2eViewerCredentials || !process.env.DATABASE_URL, e2eViewerCredentialsSkipReason);
  });

  test('lands on the login form with the expired notice, no redirect loop', async ({ page }) => {
    await loginAs(page, e2eViewerEmail, e2eViewerPassword!, /\/(dashboard|operator-console|tickets|clients)/);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query(
        `UPDATE "User" SET token_version = token_version + 1 WHERE email = $1 AND deleted_at IS NULL`,
        [e2eViewerEmail],
      );
    } finally {
      await pool.end();
    }

    await page.goto('/clients', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByText('Sesión expirada')).toBeVisible();
  });
});
