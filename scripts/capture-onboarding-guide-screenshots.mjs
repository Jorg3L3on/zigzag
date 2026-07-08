/**
 * Captures polished screenshots for onboarding HTML guides.
 * Outputs WebP (via sharp) and hides the Next.js dev indicator.
 *
 * Usage: npm run guides:capture
 * Default: production server on http://127.0.0.1:3070
 * Requires: running app + DATABASE_URL + E2E credentials + demo seed.
 */
import { mkdir, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { chromium, devices } from '@playwright/test';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const guidesDir = path.join(root, 'public', 'guides');
const assetsDir = path.join(guidesDir, 'assets');
const masterDir = path.join(guidesDir, 'images', 'empresa-maestra');
const companyDir = path.join(guidesDir, 'images', 'empresa');

const prodBaseUrl = 'http://127.0.0.1:3070';
const devBaseUrl = 'http://127.0.0.1:3069';

const baseUrl =
  process.env.GUIDES_BASE_URL ??
  (process.env.PLAYWRIGHT_USE_DEV === '1' ? devBaseUrl : prodBaseUrl);

const e2ePassword = process.env.E2E_PASSWORD;
const tenantEmail = process.env.GUIDES_TENANT_EMAIL ?? 'demo@zigzag.app';
const systemEmail = process.env.E2E_SYSTEM_EMAIL ?? 'jorge@jorge.com';
const tenantCompanyName = process.env.E2E_COMPANY_NAME ?? 'ClimaTotal Demo';
const showcaseClientName =
  process.env.DEMO_SHOWCASE_CLIENT_NAME ?? 'Hotel Riviera Dorada';
const showcaseTicketId = process.env.DEMO_SHOWCASE_TICKET_ID ?? '1000';
const demoCompanyId = Number(process.env.DEMO_COMPANY_ID ?? 4);

const hideDevUiCss = `
  nextjs-portal,
  [data-nextjs-toast],
  [data-next-badge],
  #__next-build-watcher,
  [data-nextjs-dev-tools-button],
  button[aria-label*="Next.js"],
  button[aria-label*="next.js" i],
  #devtools-indicator,
  .nextjs-toast-errors-parent,
  [class*="nextjs-toast"],
  [id*="nextjs"],
  [data-next-mark] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

const hideDevUi = async (page) => {
  await page.addStyleTag({ content: hideDevUiCss });
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal, [data-nextjs-toast]').forEach((el) => {
      el.remove();
    });
  });
};

const waitForAppReady = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  await hideDevUi(page);
};

const toWebp = async (pngPath) => {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  await sharp(pngPath).webp({ quality: 84 }).toFile(webpPath);
  await unlink(pngPath).catch(() => undefined);
  return webpPath;
};

const screenshot = async (page, filePath, options = {}) => {
  const pngPath = filePath.endsWith('.webp')
    ? filePath.replace(/\.webp$/i, '.png')
    : `${filePath}.png`.replace(/\.png\.png$/, '.png');
  const webpPath = pngPath.replace(/\.png$/i, '.webp');

  await waitForAppReady(page);

  if (options.locator) {
    await options.locator.screenshot({ path: pngPath });
  } else {
    await page.screenshot({
      path: pngPath,
      fullPage: options.fullPage ?? false,
    });
  }

  await toWebp(pngPath);
  console.log(`  ✓ ${path.relative(root, webpPath)}`);
  return webpPath;
};

const getSelectedCompanyId = async (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('selectedCompany');
    if (!raw) return null;
    try {
      const company = JSON.parse(raw);
      return typeof company.id === 'number' ? company.id : Number(company.id);
    } catch {
      return null;
    }
  });

const loginAs = async (page, email, password, expectedPath) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .waitForFunction(
      () => document.querySelector('form[data-hydrated="true"]') !== null,
      null,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/callback/credentials') &&
        response.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.getByRole('button', { name: 'Iniciar sesión' }).click(),
  ]);
  await page
    .waitForURL(expectedPath, { timeout: 45_000 })
    .catch(async () => {
      const current = page.url();
      if (typeof expectedPath === 'string' && current.includes(expectedPath)) return;
      if (expectedPath instanceof RegExp && expectedPath.test(current)) return;
      throw new Error(`Login failed for ${email}. Current URL: ${current}`);
    });
  await hideDevUi(page);
};

const openCompanySwitcher = async (page) => {
  const switcher = page
    .getByRole('button')
    .filter({ has: page.getByText(/zigzag|ClimaTotal|SOLUCIONES|Empresa/i) })
    .first();

  if ((await switcher.count()) === 0 || !(await switcher.isEnabled())) {
    return null;
  }

  await switcher.click();
  await page.getByRole('menu').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  return switcher;
};

const selectCompany = async (page, companyName) => {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await openCompanySwitcher(page);
  const menuItem = page.getByRole('menuitem', { name: companyName });
  await menuItem.waitFor({ state: 'visible', timeout: 10_000 });
  await menuItem.click({ force: true });
  await page.waitForTimeout(900);
};

const selectOperatorConsoleCompany = async (page, companyName) => {
  await selectCompany(page, companyName);
  await page.goto(`${baseUrl}/operator-console`, { waitUntil: 'domcontentloaded' });
  const selectButton = page.getByRole('button', {
    name: new RegExp(`Seleccionar contexto ${companyName}`, 'i'),
  });
  if ((await selectButton.count()) > 0) {
    await selectButton.first().click();
    await page.waitForTimeout(1200);
  }
};

const captureOperatorPanel = async (page, headingText, fileName) => {
  const heading = page.getByText(headingText, { exact: true }).first();
  if ((await heading.count()) === 0) {
    console.warn(`  ⚠ Panel no encontrado: ${headingText}`);
    return;
  }
  const panel = heading.locator('xpath=ancestor::section[1]');
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await screenshot(page, fileName, { locator: panel });
};

const captureInvoicePdf = async (page, companyId) => {
  const resolvedCompanyId = companyId ?? demoCompanyId;
  const invoiceUrl = `${baseUrl}/api/tickets/${showcaseTicketId}/invoice?company_id=${resolvedCompanyId}`;

  try {
    const pdfBase64 = await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }, invoiceUrl);

    const previewPage = await page.context().newPage();
    await previewPage.setViewportSize({ width: 920, height: 1180 });
    await previewPage.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        </head>
        <body style="margin:0;background:#e2e8f0;display:flex;justify-content:center;padding:24px;">
          <canvas id="invoice"></canvas>
          <script>
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const data = atob('${pdfBase64}');
            const bytes = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
            pdfjsLib.getDocument({ data: bytes }).promise
              .then((pdf) => pdf.getPage(1))
              .then((pdfPage) => {
                const viewport = pdfPage.getViewport({ scale: 1.35 });
                const canvas = document.getElementById('invoice');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                return pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
              })
              .then(() => { window.__pdfReady = true; });
          </script>
        </body>
      </html>
    `);
    await previewPage.waitForFunction(() => window.__pdfReady === true, null, {
      timeout: 30_000,
    });
    await previewPage.waitForTimeout(300);
    await screenshot(previewPage, path.join(companyDir, '10-factura-pdf'));
    await previewPage.close();
  } catch (error) {
    console.warn(`  ⚠ Factura PDF no capturada: ${error.message}`);
  }
};

const captureMasterCompany = async (page) => {
  console.log('\n📸 Empresa maestra (zigzag)…');
  await loginAs(page, systemEmail, e2ePassword, /\/operator-console/);
  await page.getByText('Consola operadora').first().waitFor({ timeout: 20_000 });
  await screenshot(page, path.join(masterDir, '01-consola-operadora'));

  await selectOperatorConsoleCompany(page, tenantCompanyName);
  await page.getByText('Acceso y cuentas').waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await captureOperatorPanel(
    page,
    'Acceso y cuentas',
    path.join(masterDir, '01b-operator-acceso'),
  );
  await captureOperatorPanel(
    page,
    'Actividad reciente',
    path.join(masterDir, '01c-operator-actividad'),
  );

  await page.goto(`${baseUrl}/companies`);
  await page.getByRole('heading', { name: /Empresas/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(masterDir, '02-empresas'));

  await page.goto(`${baseUrl}/users`);
  await page.getByRole('heading', { name: /Usuarios/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(masterDir, '03-usuarios'));

  await page.goto(`${baseUrl}/roles`);
  await page.getByRole('heading', { name: /Roles/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(masterDir, '03b-roles-permisos'));

  await page.goto(`${baseUrl}/audit`);
  await page.getByRole('heading', { name: /Auditoría/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(masterDir, '04-auditoria'));

  await selectCompany(page, tenantCompanyName);
  await page.goto(`${baseUrl}/dashboard`);
  await page.locator('#dashboard-revenue-chart-title').waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(masterDir, '05-dashboard-tenant'));

  await openCompanySwitcher(page);
  await page.waitForTimeout(400);
  await screenshot(page, path.join(masterDir, '06-selector-empresa'));
  await page.keyboard.press('Escape').catch(() => undefined);
};

const captureCreateTicketForm = async (page) => {
  await page.goto(`${baseUrl}/tickets/create`);
  await page.getByText('Información del cliente').first().waitFor({ timeout: 20_000 });

  const clientCombobox = page.getByRole('combobox', { name: 'Seleccionar cliente' });
  await clientCombobox.click();
  const clientOption = page.getByRole('option', { name: new RegExp(showcaseClientName, 'i') });
  if ((await clientOption.count()) > 0) {
    await clientOption.first().click();
  } else {
    await page.getByRole('option').first().click();
  }

  await page.waitForTimeout(500);
  await screenshot(page, path.join(companyDir, '08-crear-ticket'));
};

const captureTenantCompany = async (page) => {
  console.log('\n📸 Empresa operativa…');
  await loginAs(page, tenantEmail, e2ePassword, /\/dashboard/);
  const companyId = (await getSelectedCompanyId(page)) ?? demoCompanyId;

  await page.locator('#dashboard-revenue-chart-title').waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '01-dashboard'));

  await page.goto(`${baseUrl}/tickets`);
  await page.getByRole('heading', { name: /Tickets/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '02-tickets'));

  await captureCreateTicketForm(page);

  await page.goto(`${baseUrl}/tickets/${showcaseTicketId}/services`);
  await page.waitForURL(new RegExp(`/tickets/${showcaseTicketId}/services`), { timeout: 20_000 }).catch(() => undefined);
  await page.getByRole('heading', { name: /Servicios/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '09-agregar-servicios'));

  await page.goto(`${baseUrl}/services`);
  await page.getByRole('heading', { name: /Servicios/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '03-servicios'));

  await page.goto(`${baseUrl}/clients`);
  await page.getByRole('heading', { name: /Clientes/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '04-clientes'));

  await page.goto(`${baseUrl}/company`);
  await page.getByRole('heading', { name: /Mi empresa|Empresa/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '05-mi-empresa'));

  await page.goto(`${baseUrl}/tickets/${showcaseTicketId}/edit`);
  await page.waitForURL(new RegExp(`/tickets/${showcaseTicketId}/edit`), { timeout: 20_000 }).catch(() => undefined);
  await page.getByLabel('Descargar PDF del ticket').waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '06-detalle-ticket'));

  await captureInvoicePdf(page, companyId);

  await page.goto(`${baseUrl}/service-schedules`);
  await page.getByRole('heading', { name: /Recordatorios/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '07-recordatorios'));

  await page.goto(`${baseUrl}/roles`);
  await page.getByRole('heading', { name: /Roles/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '11-roles-permisos'));

  await captureGlobalSearch(page);
};

const captureGlobalSearch = async (page) => {
  await page.goto(`${baseUrl}/dashboard`);
  await page.locator('#dashboard-revenue-chart-title').waitFor({ timeout: 20_000 }).catch(() => undefined);
  await page.getByRole('button', { name: /Buscar/i }).click();
  await page
    .getByPlaceholder('Buscar tickets, clientes o servicios…')
    .fill('Riviera');
  await page.waitForTimeout(500);
  await page.getByText(/Riviera|Hotel/i).first().waitFor({ timeout: 10_000 }).catch(() => undefined);
  await screenshot(page, path.join(companyDir, '13-busqueda-global'));
  await page.keyboard.press('Escape').catch(() => undefined);
};

const captureMobileTenant = async (page) => {
  console.log('\n📱 Vista móvil (tenant)…');
  await loginAs(page, tenantEmail, e2ePassword, /\/dashboard/);

  await page.goto(`${baseUrl}/tickets`);
  await page.getByTestId('mobile-app-bar').first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  await screenshot(page, path.join(companyDir, '12-mobile-tickets'));
};

const captureSharedLogin = async (page) => {
  console.log('\n📸 Pantalla de inicio de sesión…');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 });
  await screenshot(page, path.join(masterDir, '00-login'));
  await copyFile(
    path.join(masterDir, '00-login.webp'),
    path.join(companyDir, '00-login.webp'),
  );
  console.log(`  ✓ ${path.relative(root, path.join(companyDir, '00-login.webp'))} (copia)`);
};

async function syncGuideCredentials() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!e2ePassword || !databaseUrl) {
    console.warn('Skipping credential sync (E2E_PASSWORD or DATABASE_URL missing).');
    return;
  }

  const hash = await bcrypt.hash(e2ePassword, 12);
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    for (const email of new Set([tenantEmail, systemEmail, 'demo@zigzag.app'])) {
      await pool.query(
        `UPDATE "User" SET password = $1 WHERE email = $2 AND deleted_at IS NULL`,
        [hash, email],
      );
    }
    console.log('Synced guide capture credentials from E2E_PASSWORD.');
  } finally {
    await pool.end();
  }
}

async function main() {
  if (!e2ePassword) {
    console.error('E2E_PASSWORD is required in .env');
    process.exit(1);
  }

  await syncGuideCredentials();

  await mkdir(masterDir, { recursive: true });
  await mkdir(companyDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });
  await copyFile(path.join(root, 'public', 'logo.png'), path.join(assetsDir, 'logo.png'));

  console.log(`Base URL: ${baseUrl}`);

  const browser = await chromium.launch();

  const newDesktopPage = async () => {
    const context = await browser.newContext({
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    return { context, page: await context.newPage() };
  };

  const newMobilePage = async () => {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
    });
    return { context, page: await context.newPage() };
  };

  try {
    const loginSession = await newDesktopPage();
    try {
      await captureSharedLogin(loginSession.page);
    } finally {
      await loginSession.context.close();
    }

    const masterSession = await newDesktopPage();
    try {
      await captureMasterCompany(masterSession.page);
    } finally {
      await masterSession.context.close();
    }

    const tenantSession = await newDesktopPage();
    try {
      await captureTenantCompany(tenantSession.page);
    } finally {
      await tenantSession.context.close();
    }

    const mobileSession = await newMobilePage();
    try {
      await captureMobileTenant(mobileSession.page);
    } finally {
      await mobileSession.context.close();
    }

    console.log('\n✅ Capturas WebP completadas en public/guides/images/');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
