import { expect, type Page } from '@playwright/test';

export const e2eEmail = process.env.E2E_EMAIL;
export const e2ePassword = process.env.E2E_PASSWORD;

export const e2eSystemEmail = process.env.E2E_SYSTEM_EMAIL ?? 'jorge@jorge.com';
export const e2eSystemPassword =
  process.env.E2E_SYSTEM_PASSWORD ?? process.env.E2E_PASSWORD;

export const e2eViewerEmail = process.env.E2E_VIEWER_EMAIL ?? 'viewer@test.com';
export const e2eViewerPassword =
  process.env.E2E_VIEWER_PASSWORD ?? process.env.E2E_PASSWORD;

export const hasE2eCredentials = Boolean(e2eEmail && e2ePassword);
export const hasE2eSystemCredentials = Boolean(
  e2eSystemEmail && e2eSystemPassword,
);
export const hasE2eViewerCredentials = Boolean(
  e2eViewerEmail && e2eViewerPassword,
);

export const e2eCredentialsSkipReason =
  'Set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E';
export const e2eSystemCredentialsSkipReason =
  'Set E2E_SYSTEM_EMAIL/E2E_SYSTEM_PASSWORD or E2E_PASSWORD for system-user E2E';
export const e2eViewerCredentialsSkipReason =
  'Set E2E_VIEWER_PASSWORD or E2E_PASSWORD for viewer E2E';

export const loginAs = async (
  page: Page,
  email: string,
  password: string,
  expectedLandingPath: RegExp = /\/dashboard/,
) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .waitForFunction(
      () =>
        document.querySelector('form[data-hydrated="true"]') !== null,
      null,
      { timeout: 15_000 },
    )
    .catch(() => undefined);

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  const submitButton = page.getByRole('button', { name: 'Iniciar sesión' });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/callback/credentials') &&
        response.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    submitButton.click(),
  ]);

  const loginError = page.getByText(
    /Correo o contraseña incorrectos|No se pudo iniciar sesión/,
  );
  await Promise.race([
    expect(page).toHaveURL(expectedLandingPath, { timeout: 30_000 }),
    loginError.waitFor({ state: 'visible', timeout: 30_000 }).then(async () => {
      throw new Error(`Login failed for ${email}: ${await loginError.textContent()}`);
    }),
  ]);
};

export const login = async (page: Page) => {
  await loginAs(page, e2eEmail!, e2ePassword!);
};

export const loginAsSystemUser = async (page: Page) => {
  await loginAs(page, e2eSystemEmail, e2eSystemPassword!, /\/operator-console/);
};

export const loginAsViewer = async (page: Page) => {
  await loginAs(page, e2eViewerEmail, e2eViewerPassword!);
};

const hasTenantCompanySelected = (companyName: string) => {
  const raw = localStorage.getItem('selectedCompany');
  if (!raw) return false;
  try {
    const company = JSON.parse(raw) as { name?: string; is_system?: boolean };
    return company.name === companyName && company.is_system !== true;
  } catch {
    return false;
  }
};

const hasSystemCompanySelected = () => {
  const raw = localStorage.getItem('selectedCompany');
  if (!raw) return false;
  try {
    const company = JSON.parse(raw) as { is_system?: boolean };
    return company.is_system === true;
  } catch {
    return false;
  }
};

/** System-company sessions default to the platform tenant; pick an operational company. */
export const ensureTenantCompany = async (
  page: Page,
  companyName = process.env.E2E_COMPANY_NAME ?? 'SOLUCIONES CHANO',
) => {
  if (await page.evaluate(hasTenantCompanySelected, companyName)) {
    return;
  }

  const platformSwitcher = page
    .getByRole('button')
    .filter({ has: page.getByText('zigzag', { exact: true }) })
    .first();
  if ((await platformSwitcher.count()) > 0 && (await platformSwitcher.isEnabled())) {
    await platformSwitcher.click();
    await page.getByRole('menuitem', { name: companyName }).click();
  }

  await page.waitForFunction(hasTenantCompanySelected, companyName, {
    timeout: 30_000,
  });
};

/** Select the platform (system) company for audit/companies modules. */
export const ensureSystemCompany = async (
  page: Page,
  companyName = process.env.E2E_SYSTEM_COMPANY_NAME ?? 'zigzag',
) => {
  if (await page.evaluate(hasSystemCompanySelected)) {
    return;
  }

  const switcher = page
    .getByRole('button')
    .filter({ has: page.getByText(/zigzag|SOLUCIONES/i) })
    .first();

  if ((await switcher.count()) > 0 && (await switcher.isEnabled())) {
    await switcher.click();
    await page.getByRole('menuitem', { name: companyName }).click();
  }

  await page.waitForFunction(hasSystemCompanySelected, null, {
    timeout: 30_000,
  });
};
