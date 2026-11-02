import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I36 M-16: on the phone layout every visible text is at least 14 px and every
 * tap target at least 44 px. Walks the main screens at 393 px and lists offenders.
 *
 * Deliberate exceptions live in ALLOWLIST (selector + reason). Keep it short:
 * - legal fine print inside PDFs is out of scope (the PDFs are not rendered here).
 * - inline links inside a sentence are exempt from the target rule (WCAG 2.5.8).
 */
const ALLOWLIST: { selector: string; reason: string }[] = [
  { selector: 'nextjs-portal, [data-nextjs-dev-tools-button]', reason: 'Next dev overlay, not product UI' },
  { selector: '[data-reach-allow]', reason: 'Element marked as a deliberate exception in the source, with a comment' },
];

type Offender = { kind: 'text' | 'target'; what: string; size: string };

const scan = (page: Page, allow: string[]) =>
  page.evaluate((allowSelectors) => {
    const out: { kind: 'text' | 'target'; what: string; size: string }[] = [];
    const allowed = allowSelectors.join(',');
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
      for (let p: Element | null = el; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.display === 'none' || c.visibility === 'hidden') return false;
        if (p.getAttribute('aria-hidden') === 'true' && c.position === 'absolute') return false;
      }
      return !(r.width <= 1 || r.height <= 1);
    };
    const describe = (el: Element) => {
      const text = (
        el.textContent?.trim() ||
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.getAttribute('id') ||
        (el as HTMLInputElement).type ||
        ''
      )
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      const cls = String(el.getAttribute('class') ?? '').split(/\s+/).slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${text}"`;
    };
    const seen = new Set<string>();
    const push = (kind: 'text' | 'target', el: Element, size: string) => {
      const what = describe(el);
      const key = `${kind}|${what}|${size}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ kind, what, size });
    };

    // Text: any element that owns a non-blank text node.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue?.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,svg') || (allowed && el.closest(allowed))) continue;
      if (!visible(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 13.99) push('text', el, `${fs}px`);
    }

    // Targets.
    const sel =
      'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=switch],[role=checkbox],[role=menuitem],[role=combobox],[role=option]';
    document.querySelectorAll(sel).forEach((el) => {
      if (allowed && el.closest(allowed)) return;
      if (!visible(el)) return;
      if (el.closest('[aria-hidden=true]')) return;
      // Inline link inside a sentence.
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return;
      // The page you are on is not a target.
      if (el.getAttribute('aria-current') === 'page') return;
      let r = el.getBoundingClientRect();
      // A small control inside a bigger label counts as the label's area.
      const labels = [el.closest('label')];
      if ((el as HTMLInputElement).id) labels.push(document.querySelector(`label[for="${(el as HTMLInputElement).id}"]`));
      for (const l of labels) {
        const lr = l?.getBoundingClientRect();
        if (lr && lr.width * lr.height > r.width * r.height) r = lr;
      }
      if (r.width < 43.5 || r.height < 43.5) {
        push('target', el, `${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return out;
  }, allow);

test.describe('Alcance en teléfono: 14 px y 44 px (ZIG-I36 M-16)', () => {
  test.use({ viewport: { width: 393, height: 852 } });
  test.setTimeout(600_000);

  test('main phone screens keep text >= 14 px and targets >= 44 px', async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);

    const report: Record<string, Offender[]> = {};
    const walk = async (label: string, path: string) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(800);
      const found = await scan(page, ALLOWLIST.map((a) => a.selector));
      if (found.length) report[label] = found;
    };

    // List cards are buttons that router.push to the detail page; click the first one.
    const openFirst = async (list: string, card: RegExp, detail: RegExp) => {
      await page.goto(list, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: card }).first().click({ timeout: 30_000 });
      await page.waitForURL(detail, { timeout: 30_000 });
      return new URL(page.url()).pathname;
    };

    await walk('Hoy', '/dashboard');
    await walk('Tickets', '/tickets');
    await walk('Detalle de ticket', await openFirst('/tickets', /Ver ticket \d+/, /\/tickets\/\d+$/));
    await walk('Composer', '/anotar');
    await walk('Presupuestos', '/presupuestos');
    await walk('Clientes', '/clients');
    await walk('Detalle de cliente', await openFirst('/clients', /Abrir cliente/, /\/clients\/\d+$/));
    await walk('Servicios', '/services');
    await walk('Mi empresa', '/company');

    const lines = Object.entries(report).flatMap(([screen, list]) =>
      list.map((o) => `${screen} · ${o.kind} ${o.size} · ${o.what}`),
    );
    expect(lines, `Reach offenders:\n${lines.join('\n')}`).toEqual([]);
  });
});
