import fs from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('operator console responsive surfaces', () => {
  it('uses mobile cards and desktop tables in the fleet list', () => {
    const source = read(
      'src/components/operator-console/operator-company-fleet.tsx',
    );
    expect(source).toContain('md:hidden');
    expect(source).toContain('hidden overflow-hidden rounded-xl border');
    expect(source).toContain('getOperatorCompanyFleet');
  });

  it('uses mobile cards and desktop tables in activity panel', () => {
    const source = read(
      'src/components/operator-console/operator-activity-panel.tsx',
    );
    expect(source).toContain('md:hidden');
    expect(source).toContain('rounded-xl border border-border/70 md:block');
    expect(source).toContain('useReactTable');
    expect(source).toContain('TripledDataPanel');
    expect(source).toContain('debouncedSearch');
    expect(source).toContain('ACTIVITY_TABLE_SCROLL_CLASS');
    expect(source).toContain('max-h-[calc(3rem+3.25rem*10)]');
    expect(source).toContain('<table className="w-full caption-bottom text-sm">');
    expect(source).toContain('sticky top-0');
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
