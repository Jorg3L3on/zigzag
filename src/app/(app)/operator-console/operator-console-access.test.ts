import fs from 'fs';
import path from 'path';

describe('operator console access guards', () => {
  it('requires system page guard on operator console route', () => {
    const pageSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(app)/operator-console/page.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('requireSystemPage');
    expect(pageSource).toContain("requirePagePermission('companies.read')");
  });

  it('restricts operator summary API to system users', () => {
    const routeSource = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/app/api/companies/[id]/operator-summary/route.ts',
      ),
      'utf8',
    );

    expect(routeSource).toContain('company_is_system');
    expect(routeSource).toContain("fail('AU002'");
  });
});
