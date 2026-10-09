import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/db', () => ({ db: {} }));

import {
  keepsATeamManager,
  roleChangeKeepsAdmins,
  TEAM_MANAGER_PERMISSION,
  type RoleGuardDeps,
  type TeamGuardDeps,
} from '@/lib/team-guards';

const ADMIN_ROLE = 1;
const OPERATOR_ROLE = 2;

const buildDeps = (overrides: {
  managerRoles?: number[];
  otherManagers?: number;
  system?: boolean;
} = {}): TeamGuardDeps => {
  const managerRoles = overrides.managerRoles ?? [ADMIN_ROLE];
  return {
    roleGrantsPermission: jest.fn(async (roleId: number | null) =>
      roleId !== null && managerRoles.includes(roleId),
    ),
    countOtherUsersWithPermission: jest.fn(
      async () => overrides.otherManagers ?? 0,
    ),
    isSystemCompany: jest.fn(async () => overrides.system ?? false),
  } as unknown as TeamGuardDeps;
};

const change = (currentRoleId: number | null, nextRoleId: number | null) => ({
  companyId: 10,
  targetUserId: 5n,
  currentRoleId,
  nextRoleId,
});

describe('keepsATeamManager', () => {
  it('guards the users.write permission', () => {
    expect(TEAM_MANAGER_PERMISSION).toBe('users.write');
  });

  it('refuses to deactivate the last manager', async () => {
    const deps = buildDeps({ otherManagers: 0 });
    await expect(keepsATeamManager(change(ADMIN_ROLE, null), deps)).resolves.toBe(
      false,
    );
    expect(deps.countOtherUsersWithPermission).toHaveBeenCalledWith(
      10,
      'users.write',
      5n,
    );
  });

  it('refuses to demote the last manager to a role without users.write', async () => {
    await expect(
      keepsATeamManager(change(ADMIN_ROLE, OPERATOR_ROLE), buildDeps()),
    ).resolves.toBe(false);
  });

  it('allows it when another manager remains', async () => {
    await expect(
      keepsATeamManager(change(ADMIN_ROLE, null), buildDeps({ otherManagers: 1 })),
    ).resolves.toBe(true);
  });

  it('allows moving a manager to another manager role', async () => {
    const deps = buildDeps({ managerRoles: [ADMIN_ROLE, 3] });
    await expect(keepsATeamManager(change(ADMIN_ROLE, 3), deps)).resolves.toBe(true);
    expect(deps.countOtherUsersWithPermission).not.toHaveBeenCalled();
  });

  it('ignores members who are not managers', async () => {
    const deps = buildDeps();
    await expect(
      keepsATeamManager(change(OPERATOR_ROLE, null), deps),
    ).resolves.toBe(true);
    expect(deps.countOtherUsersWithPermission).not.toHaveBeenCalled();
  });

  it('never blocks system companies', async () => {
    await expect(
      keepsATeamManager(change(ADMIN_ROLE, null), buildDeps({ system: true })),
    ).resolves.toBe(true);
  });

  it('skips the lookup when the role does not change', async () => {
    const deps = buildDeps();
    await expect(
      keepsATeamManager(change(ADMIN_ROLE, ADMIN_ROLE), deps),
    ).resolves.toBe(true);
    expect(deps.roleGrantsPermission).not.toHaveBeenCalled();
  });
});

describe('roleChangeKeepsAdmins', () => {
  const NAMES: Record<number, string> = {
    1: 'users.write',
    2: 'roles.write',
    3: 'tickets.read',
  };

  const deps = (overrides: {
    holders?: number;
    outside?: Record<string, number>;
    system?: boolean;
  } = {}): RoleGuardDeps =>
    ({
      permissionNamesForIds: jest.fn(async (ids: number[]) =>
        new Set(ids.map((id) => NAMES[id])),
      ),
      countActiveUsersWithRole: jest.fn(async () => overrides.holders ?? 1),
      countUsersWithPermissionOutsideRole: jest.fn(
        async (_companyId: number, name: string) => overrides.outside?.[name] ?? 0,
      ),
      isSystemCompany: jest.fn(async () => overrides.system ?? false),
    }) as unknown as RoleGuardDeps;

  const change = (before: number[], after: number[]) => ({
    companyId: 10,
    roleId: 7,
    beforePermissionIds: before,
    afterPermissionIds: after,
  });

  it('refuses dropping users.write when the role holders are the last managers', async () => {
    await expect(roleChangeKeepsAdmins(change([1, 2, 3], [2, 3]), deps())).resolves.toBe(
      false,
    );
  });

  it('refuses dropping roles.write when nobody else has it', async () => {
    await expect(
      roleChangeKeepsAdmins(
        change([1, 2], [1]),
        deps({ outside: { 'users.write': 1 } }),
      ),
    ).resolves.toBe(false);
  });

  it('allows it when someone outside the role keeps both', async () => {
    await expect(
      roleChangeKeepsAdmins(
        change([1, 2, 3], [3]),
        deps({ outside: { 'users.write': 1, 'roles.write': 1 } }),
      ),
    ).resolves.toBe(true);
  });

  it('ignores roles nobody holds, unrelated keys, system and global roles', async () => {
    await expect(roleChangeKeepsAdmins(change([1, 2], []), deps({ holders: 0 }))).resolves.toBe(
      true,
    );
    await expect(roleChangeKeepsAdmins(change([1, 2, 3], [1, 2]), deps())).resolves.toBe(true);
    await expect(
      roleChangeKeepsAdmins(change([1, 2], []), deps({ system: true })),
    ).resolves.toBe(true);
    await expect(
      roleChangeKeepsAdmins({ ...change([1, 2], []), companyId: null }, deps()),
    ).resolves.toBe(true);
  });
});
