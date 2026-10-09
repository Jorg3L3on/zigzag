import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const hubPages = [
  ['src/app/(app)/company/page.tsx', 'company.manage'],
  ['src/app/(app)/company/equipo/page.tsx', 'users.read'],
  ['src/app/(app)/company/roles/page.tsx', 'roles.read'],
] as const;

const systemAdminPages = [
  ['src/app/(app)/users/page.tsx', 'COMPANY_HUB_TEAM_PATH', 'users.read'],
  ['src/app/(app)/roles/page.tsx', 'COMPANY_HUB_ROLES_PATH', 'roles.read'],
  [
    'src/app/(app)/permissions/page.tsx',
    'COMPANY_HUB_ROLES_PATH',
    'permissions.read',
  ],
] as const;

describe('Mi empresa hub page access (ZIG-I3-1)', () => {
  it.each(hubPages)(
    '%s requires %s at the page edge',
    (relativePath, permission) => {
      expect(readSource(relativePath)).toContain(
        `requirePagePermission('${permission}')`,
      );
    },
  );

  it.each(systemAdminPages)(
    '%s redirects tenants to the hub before the permission check',
    (relativePath, hubPath, permission) => {
      const source = readSource(relativePath);
      const redirectAt = source.indexOf(
        `await redirectTenantToCompanyHub(${hubPath})`,
      );
      const permissionAt = source.indexOf(
        `requirePagePermission('${permission}')`,
      );
      expect(redirectAt).toBeGreaterThan(-1);
      expect(permissionAt).toBeGreaterThan(redirectAt);
    },
  );

  it.each(systemAdminPages)(
    '%s also requires a system user (ZIG-I3-6)',
    (relativePath) => {
      expect(readSource(relativePath)).toContain('await requireSystemPage()');
    },
  );
});
