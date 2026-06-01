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
    expect(source).toContain('hidden overflow-hidden rounded-xl border');
  });

  it('uses responsive layout in lifecycle actions', () => {
    const source = read(
      'src/components/operator-console/operator-lifecycle-panel.tsx',
    );
    expect(source).toContain('sm:flex-row');
    expect(source).toContain('min-h-11');
  });
});
