import {
  createRole,
  deleteRole,
  getRoles,
  getRolesPaginated,
  updateRole,
} from '@/actions/roles';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockActionCrossTenantDenied,
  tenantBContext,
} from '@/test/cross-tenant-action-helpers';
import { requireActionAuth, requireActionPermission } from '@/lib/security';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    query: {
      role: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(() => ({ type: 'user', id: '201' })),
  fetchRolePermissionIds: jest.fn(async () => []),
  recordGovernanceAudit: jest.fn(),
  sanitizePermissionForAudit: jest.fn((row) => row),
  sanitizeRoleForAudit: jest.fn((row) => row),
}));
jest.mock('@/lib/company-bootstrap', () => ({
  tenantOwnerRoleName: jest.fn(() => 'tenant-owner'),
}));

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;
const mockDb = db as unknown as {
  select: jest.Mock;
  query: {
    role: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  transaction: jest.Mock;
  update: jest.Mock;
};

describe('cross-tenant IDOR - role actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionAuth.mockResolvedValue(tenantBContext());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['getRoles', () => getRoles()],
    ['getRolesPaginated', () => getRolesPaginated({ page: 1, pageSize: 10 })],
    [
      'createRole',
      () =>
        createRole({
          name: 'Foreign Role',
          description: 'Cross-tenant attempt',
          company_id: IDOR_COMPANY_A.id,
          permissions: [],
        }),
    ],
    [
      'updateRole',
      () =>
        updateRole(IDOR_RESOURCES_A.roleId, {
          name: 'Foreign Role',
          description: 'Cross-tenant attempt',
          company_id: IDOR_COMPANY_A.id,
          permissions: [],
        }),
    ],
    ['deleteRole', () => deleteRole(IDOR_RESOURCES_A.roleId)],
  ])('%s denies cross-tenant company context', async (_name, call) => {
    mockActionCrossTenantDenied(mockRequireActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.query.role.findMany).not.toHaveBeenCalled();
    expect(mockDb.query.role.findFirst).not.toHaveBeenCalled();
  });
});
