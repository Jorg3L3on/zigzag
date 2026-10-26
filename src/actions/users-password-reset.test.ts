import {
  completeForcedPasswordChange,
  resetUserTemporaryPassword,
} from '@/actions/users';
import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import { recordGovernanceAudit } from '@/lib/governance-audit';
import { requireActionAuth, requireActionPermission } from '@/lib/security';
import { bumpUserTokenVersion, revokeAgentAccessForUser } from '@/lib/session-revocation';
import { compare, hash } from 'bcryptjs';
import { loadRolePermissionNames } from '@/lib/role-rank';

jest.mock('@/lib/db', () => ({
  db: {
    query: { user: { findFirst: jest.fn() } },
    update: jest.fn(),
  },
}));
jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('@/lib/session-revocation', () => ({
  bumpUserTokenVersion: jest.fn(),
  revokeAgentAccessForUser: jest.fn(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/role-rank', () => ({
  ...jest.requireActual('@/lib/role-rank'),
  loadRolePermissionNames: jest.fn(),
}));
jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(() => ({ userId: '1' })),
  recordGovernanceAudit: jest.fn(),
  sanitizeUserForAudit: jest.fn((row) => row),
}));

const mockDb = db as unknown as {
  query: { user: { findFirst: jest.Mock } };
  update: jest.Mock;
};
const mockAuth = requireActionAuth as jest.Mock;
const mockPermission = requireActionPermission as jest.Mock;
const mockHash = hash as jest.Mock;
const mockCompare = compare as jest.Mock;
const mockAudit = recordGovernanceAudit as jest.Mock;
const mockBump = bumpUserTokenVersion as jest.Mock;
const mockRevokeAgents = revokeAgentAccessForUser as jest.Mock;
const mockRolePermissions = loadRolePermissionNames as jest.Mock;

const member = {
  id: 20n,
  name: 'Carlos',
  email: 'carlos@b.mx',
  password: 'old-hash',
  company_id: 10,
  must_change_password: false,
  company: { id: 10, is_system: false },
};

const mockUpdate = () => {
  const where = jest.fn(async () => undefined);
  const set = jest.fn(() => ({ where }));
  mockDb.update.mockReturnValue({ set });
  return { set, where };
};

describe('resetUserTemporaryPassword (ZIG-I18-11)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuth.mockResolvedValue({ userId: '1', companyId: 10, companyIsSystem: false });
    mockPermission.mockResolvedValue({
      context: { userId: '1', companyId: 10, companyIsSystem: false },
      companyId: 10,
    });
    mockHash.mockResolvedValue('temp-hash');
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  it('gives a company admin a temporary password for a member of their company', async () => {
    mockDb.query.user.findFirst.mockResolvedValue(member);
    const { set } = mockUpdate();

    const result = await resetUserTemporaryPassword(20n);

    expect(result.success).toBe(true);
    expect(result.data?.temporaryPassword).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(mockPermission).toHaveBeenCalledWith('users.write', 10);
    expect(mockHash).toHaveBeenCalledWith(result.data?.temporaryPassword, 10);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'temp-hash', must_change_password: true }),
    );
    expect(mockBump).toHaveBeenCalledWith(20n);
    // The reset also ends the member's API keys and OAuth grants.
    expect(mockRevokeAgents).toHaveBeenCalledWith(20n, 'password_reset', expect.any(BigInt));
    expect(mockAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: 'password_reset', resourceId: 20n, targetCompanyId: 10 }),
    );
    // The temporary password never reaches the audit trail.
    expect(JSON.stringify(mockAudit.mock.calls[0][1], (_k, v) => (typeof v === 'bigint' ? String(v) : v))).not.toContain(
      result.data?.temporaryPassword,
    );
  });

  it('refuses a user of another company', async () => {
    mockDb.query.user.findFirst.mockResolvedValue({ ...member, company_id: 99 });
    mockPermission.mockRejectedValue(new AuthorizationError('Access denied to this company'));
    mockUpdate();

    const result = await resetUserTemporaryPassword(20n);

    expect(result.success).toBe(false);
    expect(mockPermission).toHaveBeenCalledWith('users.write', 99);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
  });

  it('refuses a system operator for a company admin', async () => {
    mockDb.query.user.findFirst.mockResolvedValue({
      ...member,
      company: { id: 10, is_system: true },
    });
    mockUpdate();

    const result = await resetUserTemporaryPassword(20n);

    expect(result.success).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('refuses a member whose role has permissions the caller lacks (ZIG-I32 review)', async () => {
    mockDb.query.user.findFirst
      .mockResolvedValueOnce({ ...member, role_id: 1 }) // target: Admin
      .mockResolvedValueOnce({ role_id: 2 }); // caller: Operator with users.write
    mockRolePermissions.mockResolvedValue(
      new Map([
        [1, new Set(['users.read', 'users.write', 'roles.write', 'company.manage'])],
        [2, new Set(['users.read', 'users.write'])],
      ]),
    );
    mockUpdate();

    const result = await resetUserTemporaryPassword(20n);

    expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'US010' }));
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
  });

  it('lets a caller reset someone with the same or fewer permissions', async () => {
    mockDb.query.user.findFirst
      .mockResolvedValueOnce({ ...member, role_id: 3 }) // target: Viewer
      .mockResolvedValueOnce({ role_id: 1 }); // caller: Admin
    mockRolePermissions.mockResolvedValue(
      new Map([
        [3, new Set(['users.read'])],
        [1, new Set(['users.read', 'users.write', 'roles.write'])],
      ]),
    );
    mockUpdate();

    expect((await resetUserTemporaryPassword(20n)).success).toBe(true);
  });

  it('refuses to reset yourself and an unknown user', async () => {
    mockDb.query.user.findFirst.mockResolvedValue({ ...member, id: 1n });
    expect((await resetUserTemporaryPassword(1n)).success).toBe(false);

    mockDb.query.user.findFirst.mockResolvedValue(undefined);
    expect((await resetUserTemporaryPassword(404n)).success).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('lets a system operator reset a user of any company', async () => {
    mockAuth.mockResolvedValue({ userId: '1', companyId: 1, companyIsSystem: true });
    mockPermission.mockResolvedValue({
      context: { userId: '1', companyId: 1, companyIsSystem: true },
      companyId: 77,
    });
    mockDb.query.user.findFirst.mockResolvedValue({ ...member, company_id: 77 });
    mockUpdate();

    const result = await resetUserTemporaryPassword(20n);

    expect(result.success).toBe(true);
    expect(mockPermission).toHaveBeenCalledWith('users.write', 77);
    expect(mockAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: 'password_reset', targetCompanyId: 77 }),
    );
  });
});

describe('completeForcedPasswordChange (ZIG-I18-11)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuth.mockResolvedValue({ userId: '20', companyId: 10, companyIsSystem: false });
    mockHash.mockResolvedValue('new-hash');
    mockCompare.mockResolvedValue(false);
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  it('only runs through the pending-change gate', async () => {
    mockDb.query.user.findFirst.mockResolvedValue({ ...member, must_change_password: true });
    mockUpdate();

    await completeForcedPasswordChange({ newPassword: 'mi-clave-2026', confirmPassword: 'mi-clave-2026' });

    expect(mockAuth).toHaveBeenCalledWith({ allowPasswordChangePending: true });
  });

  it('saves the new password, clears the flag and writes the audit event', async () => {
    mockDb.query.user.findFirst.mockResolvedValue({ ...member, must_change_password: true });
    const { set } = mockUpdate();

    const result = await completeForcedPasswordChange({
      newPassword: 'mi-clave-2026',
      confirmPassword: 'mi-clave-2026',
    });

    expect(result.success).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'new-hash', must_change_password: false }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: 'password_changed', resourceId: 20n }),
    );
  });

  it('refuses when nothing is pending, the passwords differ, are short, or equal the temporary one', async () => {
    mockDb.query.user.findFirst.mockResolvedValue({ ...member, must_change_password: false });
    mockUpdate();
    expect(
      (await completeForcedPasswordChange({ newPassword: 'mi-clave-2026', confirmPassword: 'mi-clave-2026' })).success,
    ).toBe(false);

    mockDb.query.user.findFirst.mockResolvedValue({ ...member, must_change_password: true });
    expect(
      (await completeForcedPasswordChange({ newPassword: 'mi-clave-2026', confirmPassword: 'otra-cosa-123' })).success,
    ).toBe(false);
    expect(
      (await completeForcedPasswordChange({ newPassword: 'corta', confirmPassword: 'corta' })).success,
    ).toBe(false);

    mockCompare.mockResolvedValue(true);
    expect(
      (await completeForcedPasswordChange({ newPassword: 'mi-clave-2026', confirmPassword: 'mi-clave-2026' })).success,
    ).toBe(false);

    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
