import { canAccessPermission, PERMISSIONS } from '@/lib/permissions';

describe('permission contract', () => {
  it('allows system users to access every permission', () => {
    expect(
      canAccessPermission(
        { isSystem: true, permissions: [] },
        PERMISSIONS.companies.write,
      ),
    ).toBe(true);
  });

  it('allows regular users with the requested permission', () => {
    expect(
      canAccessPermission(
        { isSystem: false, permissions: [PERMISSIONS.clients.write] },
        PERMISSIONS.clients.write,
      ),
    ).toBe(true);
  });

  it('denies regular users without the requested permission', () => {
    expect(
      canAccessPermission(
        { isSystem: false, permissions: [PERMISSIONS.clients.read] },
        PERMISSIONS.clients.write,
      ),
    ).toBe(false);
  });
});
