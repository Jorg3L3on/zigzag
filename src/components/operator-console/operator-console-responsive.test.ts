import fs from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('operator console responsive surfaces', () => {
  it('uses phone cards and the desktop list table in the fleet list', () => {
    const source = read(
      'src/components/operator-console/operator-company-fleet.tsx',
    );
    expect(source).toContain('<DesktopSwitch phone={phone} desktop={desktop} />');
    expect(source).toContain('<ListTable');
    expect(source).toContain('<ListToolbar');
    expect(source).not.toContain('md:hidden');
    expect(source).toContain('getOperatorCompanyFleet');
  });

  it('uses phone cards and the desktop list table in activity panel', () => {
    const source = read(
      'src/components/operator-console/operator-activity-panel.tsx',
    );
    expect(source).toContain('<DesktopSwitch');
    expect(source).not.toContain('md:hidden');
    expect(source).toContain('useReactTable');
    expect(source).toContain('OperatorActivityFilterBar');
    expect(source).toContain('<ListToolbar');
    expect(source).toContain('debouncedSearch');
    expect(source).toContain('ACTIVITY_TABLE_SCROLL_CLASS');
    expect(source).toContain('max-h-[calc(3rem+3.25rem*10)]');
    // The list header sticks at the top of the scroll area (ZIG-I33 §4).
    expect(source).toContain('stickyTop="top-0"');
    expect(source).toContain('max-h-[calc(2.5rem+3.5rem*10)]');
  });

  it('sorts both console tables with the shared list header', () => {
    const fleetColumns = read(
      'src/components/operator-console/operator-company-fleet-columns.tsx',
    );
    const activityColumns = read(
      'src/components/operator-console/operator-activity-columns.tsx',
    );
    expect(fleetColumns).not.toContain('FleetSortableHeader');
    expect(activityColumns).not.toMatch(/(^|[^A-Za-z])SortableHeader/);
    expect(fleetColumns).toContain('ListSortableHeader');
    expect(activityColumns).toContain('ListSortableHeader');
  });

  it('keeps sticky company chrome in the detail shell', () => {
    const source = read(
      'src/components/operator-console/operator-console-detail.tsx',
    );
    expect(source).toContain('sticky top-0');
    expect(source).toContain('Empresa actual');
    expect(source).toContain('sharedSummary');
  });

  it('separates suspended and archived fleet filters', () => {
    const fleetSource = read(
      'src/components/operator-console/operator-company-fleet.tsx',
    );
    const filterBarSource = read(
      'src/components/companies/companies-filter-bar.tsx',
    );
    expect(fleetSource).toContain('FLEET_STATUS_FILTER_OPTIONS');
    expect(fleetSource).toContain('CompaniesFilterBar');
    expect(fleetSource).toContain('operatorConsoleCompanyHref');
    expect(filterBarSource).toContain("value: 'suspended'");
    expect(filterBarSource).toContain("value: 'archived'");
  });

  it('composes fleet then tabbed detail on the operator page', () => {
    const source = read('src/app/(app)/operator-console/page.tsx');
    const fleetIndex = source.indexOf('<OperatorCompanyFleet');
    const detailIndex = source.indexOf('<OperatorConsoleDetail');
    expect(fleetIndex).toBeGreaterThan(-1);
    expect(detailIndex).toBeGreaterThan(-1);
    expect(fleetIndex).toBeLessThan(detailIndex);
    expect(source).not.toContain('CompaniesList');
  });

  it('exposes resumen actividad acceso and ciclo tabs in detail', () => {
    const source = read(
      'src/components/operator-console/operator-console-detail.tsx',
    );
    expect(source).toContain("id: 'resumen'");
    expect(source).toContain("id: 'actividad'");
    expect(source).toContain("id: 'acceso'");
    expect(source).toContain("id: 'ciclo'");
    expect(source).toContain('OperatorCompanyMetrics');
    expect(source).toContain('resolveOperatorPrimaryCta');
    expect(source).toContain('buildOperatorAttentionSignals');
  });

  it('uses responsive layout in lifecycle actions', () => {
    const source = read(
      'src/components/operator-console/operator-lifecycle-panel.tsx',
    );
    expect(source).toContain('sm:flex-row');
    expect(source).toContain('min-h-11');
  });
});
