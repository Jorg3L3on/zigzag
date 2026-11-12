import fs from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('operator console structure (ZIG-I38)', () => {
  it('the fleet page renders only the fleet, in the page frame, with a loading route', () => {
    const page = read('src/app/(app)/operator-console/page.tsx');
    expect(page).toContain('<OperatorCompanyFleet');
    expect(page).not.toContain('OperatorConsoleDetail');
    expect(page).toContain('desktop="title"');
    expect(page).not.toContain('Suspense fallback={null}');
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/(app)/operator-console/loading.tsx'))).toBe(true);
  });

  it('each company tab is a route under /operator-console/[id]', () => {
    for (const tab of ['resumen', 'actividad', 'acceso', 'ciclo-de-vida']) {
      expect(
        fs.existsSync(path.join(process.cwd(), `src/app/(app)/operator-console/[id]/${tab}/page.tsx`)),
      ).toBe(true);
    }
  });

  it('opening a company never sets the app company; only «Operar como esta empresa» does (P3, E5)', () => {
    const fleet = read('src/components/operator-console/operator-company-fleet.tsx');
    const shell = read('src/components/operator-console/operator-company-shell.tsx');
    const actions = read('src/components/operator-console/use-operator-company-actions.ts');
    expect(fleet).not.toContain('setSelectedCompany');
    expect(shell).not.toContain('setSelectedCompany');
    expect(actions).toContain('setSelectedCompany');
    expect(fleet).not.toContain('OPERATOR_CONSOLE_COMPANY_QUERY_PARAM');
  });

  it('states are ListStatusPill, never ui/badge (E15)', () => {
    for (const file of [
      'operator-company-fleet.tsx',
      'operator-company-fleet-columns.tsx',
      'operator-company-shell.tsx',
      'operator-company-overview.tsx',
      'operator-activity-panel.tsx',
      'operator-access-panel.tsx',
      'operator-lifecycle-panel.tsx',
    ]) {
      expect(read(`src/components/operator-console/${file}`)).not.toContain("from '@/components/ui/badge'");
    }
  });

  it('no inner scroll boxes and no inner tablists in the tabs (A3, C1, R4)', () => {
    for (const file of [
      'operator-company-overview.tsx',
      'operator-activity-panel.tsx',
      'operator-access-panel.tsx',
    ]) {
      const source = read(`src/components/operator-console/${file}`);
      expect(source).not.toMatch(/max-h-\[calc/);
      expect(source).not.toContain('role="tablist"');
    }
  });

  it('dialogs keep the request in view: preventDefault and «Aplicando…» (E9)', () => {
    for (const file of ['operator-company-shell.tsx', 'operator-lifecycle-panel.tsx', 'operator-access-panel.tsx']) {
      const source = read(`src/components/operator-console/${file}`);
      expect(source).toContain('event.preventDefault()');
      expect(source).toContain('Aplicando…');
    }
    expect(read('src/components/operator-console/operator-lifecycle-panel.tsx')).not.toContain(
      'window.location.reload',
    );
  });

  it('the fleet loader reads no payload and no ILIKE (E13)', () => {
    const loader = read('src/lib/company-operator-fleet-loader.ts');
    const facts = read('src/lib/company-operator-facts-loader.ts');
    for (const source of [loader, facts]) {
      expect(source).not.toMatch(/payload:\s*auditEvent\.payload/);
      expect(source.toLowerCase()).not.toContain('ilike');
    }
  });
});
