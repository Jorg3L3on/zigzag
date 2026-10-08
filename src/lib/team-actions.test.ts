import {
  addTeamMember,
  changeTeamMemberRole,
  deactivateTeamMember,
  getTeam,
  updateTeamMember,
} from '@/actions/team';
import { createUser, deleteUser, updateUser } from '@/actions/users';
import { db } from '@/lib/db';
import { checkPermission, requireActionPermission } from '@/lib/security';
import {
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  mockActionAuthorized,
  mockActionPermissionDenied,
} from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: { findMany: jest.fn(), findFirst: jest.fn() },
      role: { findMany: jest.fn() },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
  checkPermission: jest.fn(),
}));

jest.mock('@/actions/users', () => ({
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
}));

const mockDb = db as unknown as {
  query: {
    user: { findMany: jest.Mock; findFirst: jest.Mock };
    role: { findMany: jest.Mock };
  };
};
const mockRequireActionPermission = requireActionPermission as jest.MockedFunction<
  typeof requireActionPermission
>;
const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;
const mockCreateUser = createUser as jest.MockedFunction<typeof createUser>;
const mockUpdateUser = updateUser as jest.MockedFunction<typeof updateUser>;
const mockDeleteUser = deleteUser as jest.MockedFunction<typeof deleteUser>;

const ownMember = {
  id: 301n,
  name: 'Carlos',
  email: 'carlos@b.mx',
  role_id: 5,
  company_id: IDOR_COMPANY_B.id,
  deleted_at: null,
};

describe('team actions (ZIG-I3-4)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockActionAuthorized(mockRequireActionPermission);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('getTeam returns only the caller company members, without company data', async () => {
    mockDb.query.user.findMany.mockResolvedValue([
      {
        ...ownMember,
        id: 201n,
        email_verified_at: null,
        created_at: new Date('2026-10-01T00:00:00Z'),
        role: { name: 'Admin', deleted_at: null },
        password: 'hash',
      },
    ]);
    mockDb.query.role.findMany.mockResolvedValue([
      { id: 5, name: 'Admin', description: 'Todo' },
    ]);
    mockCheckPermission.mockResolvedValue(true);

    const result = await getTeam();

    expect(mockRequireActionPermission).toHaveBeenCalledWith('users.read');
    expect(result.data?.members).toEqual([
      {
        id: '201',
        name: 'Carlos',
        email: 'carlos@b.mx',
        roleId: 5,
        roleName: 'Admin',
        emailVerified: false,
        createdAt: '2026-10-01T00:00:00.000Z',
        isSelf: true,
      },
    ]);
    expect(result.data?.roles).toEqual([
      { id: 5, name: 'Admin', description: 'Todo' },
    ]);
    expect(result.data?.canWrite).toBe(true);
    expect(mockCheckPermission).toHaveBeenCalledWith(
      '201',
      IDOR_COMPANY_B.id,
      'users.write',
    );
  });

  it('addTeamMember always targets the caller company', async () => {
    mockCreateUser.mockResolvedValue({ success: true });

    await addTeamMember({
      name: 'Nueva',
      email: 'nueva@b.mx',
      role_id: 5,
      password: 'password123',
    });

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: IDOR_COMPANY_B.id }),
    );
  });

  it.each([
    ['updateTeamMember', () => updateTeamMember(IDOR_RESOURCES_A.userId, { name: 'X', email: 'x@a.mx' })],
    ['changeTeamMemberRole', () => changeTeamMemberRole(IDOR_RESOURCES_A.userId, 5)],
    ['deactivateTeamMember', () => deactivateTeamMember(IDOR_RESOURCES_A.userId)],
  ])('%s refuses a user from another company', async (_name, call) => {
    // Lookup is scoped to the caller company, so a foreign user is not found.
    mockDb.query.user.findFirst.mockResolvedValue(undefined);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('changeTeamMemberRole keeps name and email and sends the new role', async () => {
    mockDb.query.user.findFirst.mockResolvedValue(ownMember);
    mockUpdateUser.mockResolvedValue({ success: true });

    const result = await changeTeamMemberRole('301', 9);

    expect(result.success).toBe(true);
    expect(mockUpdateUser).toHaveBeenCalledWith(301n, {
      name: 'Carlos',
      email: 'carlos@b.mx',
      company_id: IDOR_COMPANY_B.id,
      role_id: 9,
    });
  });

  it('passes guard refusals through', async () => {
    mockDb.query.user.findFirst.mockResolvedValue(ownMember);
    mockDeleteUser.mockResolvedValue({
      success: false,
      error: 'Esta es la única persona… Código: US007',
      errorCode: 'US007',
      errorType: 'validation',
    } as Awaited<ReturnType<typeof deleteUser>>);

    const result = await deactivateTeamMember('301');

    expect(result).toEqual(
      expect.objectContaining({ success: false, errorCode: 'US007' }),
    );
  });

  it('rejects malformed ids without touching the database', async () => {
    const result = await deactivateTeamMember('not-a-number');

    expect(result.success).toBe(false);
    expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['getTeam', () => getTeam()],
    ['addTeamMember', () => addTeamMember({ name: 'X', email: 'x@b.mx', role_id: 5, password: 'password123' })],
    ['deactivateTeamMember', () => deactivateTeamMember('301')],
  ])('%s fails closed without the permission', async (_name, call) => {
    mockActionPermissionDenied(mockRequireActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.query.user.findMany).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
