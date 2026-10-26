/**
 * ZIG-I32 review: every server action that writes someone's role or password
 * goes through guardUserWrite (and role edits through guardRoleGrant). These
 * call the actions directly with forged inputs; the guard runs for real over
 * a mocked database.
 */
import { deactivateTeamMember } from '@/actions/team';
import { createUser, deleteUser, resetUserTemporaryPassword, updateUser } from '@/actions/users';
import { db } from '@/lib/db';
import { guardRoleGrant, guardUserWrite } from '@/lib/role-rank';
import { requireActionAuth, requireActionPermission } from '@/lib/security';
import { hash } from 'bcryptjs';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    query: {
      user: { findFirst: jest.fn() },
      role: { findFirst: jest.fn() },
    },
  },
}));
jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireSystemUser: jest.fn(),
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('@/lib/team-guards', () => ({ keepsATeamManager: jest.fn(async () => true) }));
jest.mock('@/lib/session-revocation', () => ({
  bumpUserTokenVersion: jest.fn(),
  revokeAgentAccessForUser: jest.fn(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(() => ({ userId: '1' })),
  recordGovernanceAudit: jest.fn(),
  sanitizeUserForAudit: jest.fn((row) => row),
}));

const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  query: { user: { findFirst: jest.Mock }; role: { findFirst: jest.Mock } };
};
const mockAuth = requireActionAuth as jest.Mock;
const mockPermission = requireActionPermission as jest.Mock;

// Role 1 Admin, 2 Operator (the actor: can manage users, not roles), 3 Viewer.
const ROLE_PERMISSIONS: Record<number, string[]> = {
  1: ['users.read', 'users.write', 'roles.read', 'roles.write', 'company.manage'],
  2: ['users.read', 'users.write'],
  3: ['users.read'],
};
const PERMISSION_IDS: Record<number, string> = {
  11: 'users.read',
  12: 'users.write',
  13: 'roles.write',
  14: 'company.manage',
};

const tenant = { userId: '1', companyId: 10, companyIsSystem: false };
const system = { userId: '900', companyId: 1, companyIsSystem: true };

/** Users by id; the actor (1) is an Operator. */
const USERS: Record<string, { id: bigint; role_id: number; company_id: number; name: string; email: string }> = {
  '1': { id: 1n, role_id: 2, company_id: 10, name: 'Yo', email: 'yo@a.mx' },
  '5': { id: 5n, role_id: 1, company_id: 10, name: 'Admin', email: 'admin@a.mx' },
  '6': { id: 6n, role_id: 3, company_id: 10, name: 'Lectura', email: 'lectura@a.mx' },
  '900': { id: 900n, role_id: 1, company_id: 1, name: 'Op', email: 'op@zz.mx' },
};

let targetId = '6';
let actorId = '1';

const setActor = (actor: typeof tenant) => {
  actorId = actor.userId;
  mockAuth.mockResolvedValue(actor);
  mockPermission.mockResolvedValue({ context: actor, companyId: 10 });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  setActor(tenant);
  (hash as jest.Mock).mockResolvedValue('hash');
  // The guard asks for the actor's role with `columns`; the actions load the target.
  mockDb.query.user.findFirst.mockImplementation(async (args: { columns?: unknown }) => {
    const row = args?.columns ? USERS[actorId] : USERS[targetId];
    return row ? { ...row, deleted_at: null, company: { id: row.company_id, is_system: false } } : undefined;
  });
  mockDb.query.role.findFirst.mockImplementation(async () => ({ id: 1, company_id: null, deleted_at: null }));
  mockDb.select.mockImplementation(() => ({
    from: () => ({
      innerJoin: () => ({
        where: async () =>
          Object.entries(ROLE_PERMISSIONS).flatMap(([roleId, names]) =>
            names.map((name) => ({ role_id: Number(roleId), name })),
          ),
      }),
      where: async () => Object.values(PERMISSION_IDS).map((name) => ({ name })),
    }),
  }));
  const returning = jest.fn(async () => [{ ...USERS[targetId] }]);
  mockDb.update.mockReturnValue({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning })) })) });
  mockDb.insert.mockReturnValue({ values: jest.fn(() => ({ returning: async () => [{ id: 77n }] })) });
});

const base = { company_id: 10 };

describe('updateUser goes through guardUserWrite', () => {
  it('refuses a forged role change on yourself (US009)', async () => {
    targetId = '1';
    const result = await updateUser(1n, { ...base, name: 'Yo', email: 'yo@a.mx', role_id: 1 });
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US009' }));
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('refuses a password on someone with more permissions (US010)', async () => {
    targetId = '5';
    const result = await updateUser(5n, {
      ...base,
      name: 'Admin',
      email: 'admin@a.mx',
      role_id: 1,
      password: 'forged-pass-123',
    });
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('refuses demoting someone with more permissions (US010)', async () => {
    targetId = '5';
    const result = await updateUser(5n, { ...base, name: 'Admin', email: 'admin@a.mx', role_id: 3 });
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
  });

  it('refuses giving a peer a role with more permissions than yours (US010)', async () => {
    targetId = '6';
    const result = await updateUser(6n, { ...base, name: 'Lectura', email: 'lectura@a.mx', role_id: 1 });
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
  });

  it('lets you set a password for someone with fewer permissions', async () => {
    targetId = '6';
    const result = await updateUser(6n, {
      ...base,
      name: 'Lectura',
      email: 'lectura@a.mx',
      role_id: 3,
      password: 'nueva-pass-123',
    });
    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('keeps system operators exempt', async () => {
    setActor(system);
    targetId = '5';
    const result = await updateUser(5n, { ...base, name: 'Admin', email: 'admin@a.mx', role_id: 3, password: 'op-pass-1234' });
    expect(result.success).toBe(true);
  });
});

describe('createUser and resetUserTemporaryPassword go through it too', () => {
  it('createUser refuses a role with more permissions than yours (US010)', async () => {
    const result = await createUser({ ...base, name: 'Nuevo', email: 'nuevo@a.mx', role_id: 1, password: 'temporal-123' });
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('createUser allows a role within yours', async () => {
    const result = await createUser({ ...base, name: 'Nuevo', email: 'nuevo@a.mx', role_id: 3, password: 'temporal-123' });
    expect(result.success).toBe(true);
  });

  it('resetUserTemporaryPassword refuses someone with more permissions (US010)', async () => {
    targetId = '5';
    const result = await resetUserTemporaryPassword(5n);
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

describe('deleteUser / deactivateTeamMember go through it (ZIG-I32 review)', () => {
  it('deleteUser refuses deactivating someone with more permissions (US010)', async () => {
    targetId = '5';
    const result = await deleteUser(5n, 10);
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('deactivateTeamMember refuses an Admin for a non-Admin with users.write (US010)', async () => {
    targetId = '5';
    const result = await deactivateTeamMember('5');
    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('allows deactivating someone with fewer permissions', async () => {
    targetId = '6';
    const result = await deactivateTeamMember('6');
    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('allows deactivating someone with the same permissions (Admin deactivates an Admin)', async () => {
    USERS['8'] = { id: 8n, role_id: 1, company_id: 10, name: 'Admin 2', email: 'admin2@a.mx' };
    USERS['7'] = { id: 7n, role_id: 1, company_id: 10, name: 'Admin 1', email: 'admin1@a.mx' };
    setActor({ ...tenant, userId: '7' });
    targetId = '8';
    const result = await deleteUser(8n, 10);
    expect(result.success).toBe(true);
  });
});

describe('guardUserWrite / guardRoleGrant rules', () => {
  it('ignores writes that touch neither role nor password', async () => {
    targetId = '5';
    expect(await guardUserWrite({ actor: tenant, target: { id: 5n, role_id: 1 }, nextRoleId: 1 })).toBeNull();
  });

  it('allows your own password through updateUser-like writes (no rank above yourself)', async () => {
    expect(
      await guardUserWrite({ actor: tenant, target: { id: 1n, role_id: 2 }, setsPassword: true }),
    ).toBeNull();
  });

  it('refuses granting permissions you lack and editing a role above yours (RL007)', async () => {
    expect(await guardRoleGrant({ actor: tenant, permissionIds: [11, 12, 13] })).toBe('RL007');
    expect(await guardRoleGrant({ actor: tenant, permissionIds: [], currentRoleId: 1 })).toBe('RL007');
    expect(await guardRoleGrant({ actor: system, permissionIds: [11, 12, 13], currentRoleId: 1 })).toBeNull();
  });

  it('allows a role within yours', async () => {
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        innerJoin: () => ({
          where: async () =>
            Object.entries(ROLE_PERMISSIONS).flatMap(([roleId, names]) =>
              names.map((name) => ({ role_id: Number(roleId), name })),
            ),
        }),
        where: async () => [{ name: 'users.read' }],
      }),
    }));
    expect(await guardRoleGrant({ actor: tenant, permissionIds: [11], currentRoleId: 3 })).toBeNull();
  });
});
