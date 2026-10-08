import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/db', () => ({ db: {} }));

import {
  keepsATeamManager,
  TEAM_MANAGER_PERMISSION,
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
