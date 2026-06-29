import {
  assignPermissionToRole,
  createPermission,
  deletePermission,
  getPermissions,
  getPermissionsByCompany,
  removePermissionFromRole,
  updatePermission,
} from '@/actions/permissions';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockActionCrossTenantDenied,
  tenantBContext,
} from '@/test/cross-tenant-action-helpers';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: {
      permission: { findMany: jest.fn(), findFirst: jest.fn() },
      role: { findFirst: jest.fn() },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireSystemUser: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(() => ({ type: 'user', id: '201' })),
  recordGovernanceAudit: jest.fn(),
  sanitizePermissionForAudit: jest.fn((row) => row),
}));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;
const mockRequireSystemUser = requireSystemUser as jest.MockedFunction<
  typeof requireSystemUser
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  query: {
    permission: { findMany: jest.Mock; findFirst: jest.Mock };
    role: { findFirst: jest.Mock };
  };
};

describe('cross-tenant IDOR - permission actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionAuth.mockResolvedValue(tenantBContext());
    mockRequireSystemUser.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['getPermissions', () => getPermissions()],
    [
      'getPermissionsByCompany',
      () => getPermissionsByCompany(IDOR_COMPANY_A.id),
    ],
    [
      'createPermission',
      () =>
        createPermission({
          name: 'Foreign Permission',
          description: 'Cross-tenant attempt',
          company_id: IDOR_COMPANY_A.id,
        }),
    ],
    [
      'updatePermission',
      () =>
        updatePermission(IDOR_RESOURCES_A.permissionId, {
          name: 'Foreign Permission',
          description: 'Cross-tenant attempt',
          company_id: IDOR_COMPANY_A.id,
        }),
    ],
    ['deletePermission', () => deletePermission(IDOR_RESOURCES_A.permissionId)],
    [
      'assignPermissionToRole',
      () =>
        assignPermissionToRole(
          IDOR_RESOURCES_A.roleId,
          IDOR_RESOURCES_A.permissionId,
        ),
    ],
    [
      'removePermissionFromRole',
      () =>
        removePermissionFromRole(
          IDOR_RESOURCES_A.roleId,
          IDOR_RESOURCES_A.permissionId,
        ),
    ],
  ])('%s denies cross-tenant company context', async (_name, call) => {
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockDb.query.permission.findMany).not.toHaveBeenCalled();
    expect(mockDb.query.permission.findFirst).not.toHaveBeenCalled();
    expect(mockDb.query.role.findFirst).not.toHaveBeenCalled();
  });
});
