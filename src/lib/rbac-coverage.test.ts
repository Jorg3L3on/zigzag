import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERMISSIONS } from '@/lib/permissions';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
} from '@/lib/rbac-role-matrix';

const root = process.cwd();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
  });

const read = (filePath: string) => readFileSync(filePath, 'utf8');

const relative = (filePath: string) => path.relative(root, filePath);

const hasAny = (content: string, tokens: string[]) =>
  tokens.some((token) => content.includes(token));

const nearestLayouts = (pagePath: string): string[] => {
  const dashboardRoot = path.join(root, 'src/app/(app)');
  const layouts: string[] = [];
  let dir = path.dirname(pagePath);

  while (dir.startsWith(dashboardRoot)) {
    const layoutPath = path.join(dir, 'layout.tsx');
    if (existsSync(layoutPath)) {
      layouts.push(layoutPath);
    }
    if (dir === dashboardRoot) {
      break;
    }
    dir = path.dirname(dir);
  }

  return layouts;
};

describe('RBAC coverage', () => {
  it('keeps domain server actions behind authorization helpers', () => {
    const actionFiles = walk(path.join(root, 'src/actions')).filter((filePath) =>
      filePath.endsWith('.ts'),
    );
    const allowedExceptions = new Set([
      'src/actions/authz.ts',
      // Auth-only: notifications are visible to any authenticated company member
      // and are scoped by company via requireActionAuth (like the account page).
      'src/actions/notifications.ts',
    ]);

    const missing = actionFiles
      .filter((filePath) => !allowedExceptions.has(relative(filePath)))
      .filter((filePath) => {
        const content = read(filePath);
        return !hasAny(content, [
          'requireActionPermission(',
          'checkPermission(',
          'requireScheduleRead(',
          'requireScheduleWrite(',
          'requireTicketRead(',
          'requireTicketWrite(',
          'requireClientRead(',
          'requireClientWrite(',
          'requireServiceRead(',
          'requireServiceWrite(',
          'requireCompanyRead(',
          'requireCompanyWrite(',
          'requireUserRead(',
          'requireUserWrite(',
          'requireRoleRead(',
          'requireRoleWrite(',
          'requirePermissionRead(',
          'requirePermissionWrite(',
        ]);
      })
      .map(relative);

    expect(missing).toEqual([]);
  });

  it('keeps non-public API routes behind API authorization helpers', () => {
    const routeFiles = walk(path.join(root, 'src/app/api')).filter((filePath) =>
      filePath.endsWith('/route.ts'),
    );
    const allowedPublicRoutes = new Set([
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/health/route.ts',
      // Cron endpoints secured with CRON_SECRET rather than a user session.
      'src/app/api/cron/notifications/route.ts',
      'src/app/api/cron/jobs/route.ts',
    ]);

    const missing = routeFiles
      .filter((filePath) => !allowedPublicRoutes.has(relative(filePath)))
      .filter((filePath) => {
        const content = read(filePath);
        return !hasAny(content, ['requireApiPermission(', 'requireSession(']);
      })
      .map(relative);

    expect(missing).toEqual([]);
  });

  it('keeps restricted dashboard pages behind page-level RBAC', () => {
    const dashboardRoot = path.join(root, 'src/app/(app)');
    const pageFiles = walk(dashboardRoot).filter((filePath) =>
      filePath.endsWith('/page.tsx'),
    );
    const authOnlyPages = new Set([
      'src/app/(app)/account/page.tsx',
      'src/app/(app)/forbidden/page.tsx',
    ]);

    const missing = pageFiles
      .filter((filePath) => !authOnlyPages.has(relative(filePath)))
      .filter((filePath) => {
        const pageAndLayouts = [filePath, ...nearestLayouts(filePath)];
        return !pageAndLayouts.some((candidate) =>
          hasAny(read(candidate), [
            'requirePagePermission(',
            'requireSystemPage(',
          ]),
        );
      })
      .map(relative);

    expect(missing).toEqual([]);
  });

  it('keeps auth-only dashboard exceptions behind active-session validation', () => {
    const dashboardLayout = read(path.join(root, 'src/app/(app)/layout.tsx'));
    expect(dashboardLayout).toContain('requireActionAuth(');
  });

  it('seeds every canonical permission name used in code', () => {
    const seedSource = read(path.join(root, 'scripts/seed.ts'));
    const permissionNames = Object.values(PERMISSIONS).flatMap((group) =>
      Object.values(group),
    );

    const missing = permissionNames.filter(
      (permissionName) => !seedSource.includes(`name: '${permissionName}'`),
    );

    expect(missing).toEqual([]);
  });

  it('keeps canonical RBAC contract modules present for major resources', () => {
    const contractModules = [
      'src/lib/tickets-rbac.ts',
      'src/lib/clients-rbac.ts',
      'src/lib/services-rbac.ts',
      'src/lib/companies-rbac.ts',
      'src/lib/users-rbac.ts',
      'src/lib/roles-rbac.ts',
      'src/lib/permissions-rbac.ts',
      'src/lib/system-company-context.ts',
    ];

    const missing = contractModules.filter(
      (modulePath) => !existsSync(path.join(root, modulePath)),
    );

    expect(missing).toEqual([]);
  });

  it('fails when a new PERMISSIONS entry lacks role-matrix allow/deny coverage', () => {
    const canonical = [...ALL_PERMISSIONS].sort();
    expect(canonical.length).toBeGreaterThan(0);
    expect(canonical).toEqual(
      Object.values(PERMISSIONS)
        .flatMap((group) => Object.values(group))
        .sort(),
    );

    // Matrix rows must enumerate every canonical permission (allow or deny).
    for (const [role, expectations] of Object.entries(ROLE_PERMISSION_MATRIX)) {
      expect({
        role,
        permissions: Object.keys(expectations).sort(),
      }).toEqual({
        role,
        permissions: canonical,
      });
    }

    // Source gate: the role-matrix suite must still contain per-permission
    // allow+deny coverage so new permissions cannot ship untested.
    const matrixSource = read(
      path.join(root, 'src/lib/rbac-role-matrix.test.ts'),
    );
    const matrixDataSource = read(
      path.join(root, 'src/lib/rbac-role-matrix.ts'),
    );
    expect(matrixSource).toContain('has an explicit allow and deny outcome');
    expect(matrixDataSource).toContain('ROLE_PERMISSION_MATRIX');

    for (const permission of canonical) {
      expect(matrixDataSource).toContain(permission);
    }
  });
});
