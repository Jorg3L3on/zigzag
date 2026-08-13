import fs from 'fs';
import path from 'path';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('operator console responsive surfaces', () => {
  it('uses mobile cards and desktop tables in company list', () => {
    const source = read('src/components/companies/companies-list.tsx');
    expect(source).toContain('md:hidden');
    expect(source).toContain('hidden overflow-hidden rounded-xl border');
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
  });

  it('places activity before access and accounts on the operator page', () => {
    const source = read('src/app/(app)/operator-console/page.tsx');
    const activityIndex = source.indexOf('<OperatorActivityPanel');
    const accessIndex = source.indexOf('<OperatorAccessPanel');
    expect(activityIndex).toBeGreaterThan(-1);
    expect(accessIndex).toBeGreaterThan(-1);
    expect(activityIndex).toBeLessThan(accessIndex);
  });

  it('uses responsive layout in lifecycle actions', () => {
    const source = read(
      'src/components/operator-console/operator-lifecycle-panel.tsx',
    );
    expect(source).toContain('sm:flex-row');
    expect(source).toContain('min-h-11');
  });
});
