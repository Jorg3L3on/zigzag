import {
  deleteCompanyRole,
  getCompanyRoles,
  saveCompanyRole,
} from '@/actions/company-roles';
import { createRole, deleteRole, updateRole } from '@/actions/roles';
import { db } from '@/lib/db';
import { checkPermission, requireActionPermission } from '@/lib/security';
import {
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  mockActionAuthorized,
  mockActionPermissionDenied,
} from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    query: {
      role: { findMany: jest.fn(), findFirst: jest.fn() },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
  checkPermission: jest.fn(),
}));

jest.mock('@/actions/roles', () => ({
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
}));

const mockDb = db as unknown as {
  select: jest.Mock;
  query: { role: { findMany: jest.Mock; findFirst: jest.Mock } };
};
const mockRequireActionPermission = requireActionPermission as jest.MockedFunction<
  typeof requireActionPermission
>;
const mockCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const mockCreateRole = createRole as jest.MockedFunction<typeof createRole>;
const mockUpdateRole = updateRole as jest.MockedFunction<typeof updateRole>;
const mockDeleteRole = deleteRole as jest.MockedFunction<typeof deleteRole>;

/** db.select(...).from(...).where(...)[.groupBy(...)] resolving to `rows`. */
const mockSelectRows = (rows: unknown[]) => {
  const result = Object.assign(Promise.resolve(rows), {
    groupBy: jest.fn(() => Promise.resolve(rows)),
  });
  mockDb.select.mockReturnValueOnce({
    from: jest.fn(() => ({ where: jest.fn(() => result) })),
  });
};

const catalog = [
  { id: 1, name: 'tickets.read', companyId: null },
  { id: 2, name: 'tickets.write', companyId: null },
  { id: 3, name: 'permissions.read', companyId: null },
];

const ownRole = (permissionNames: string[]) => ({
  id: 7,
  name: 'Operator',
  description: null,
  company_id: IDOR_COMPANY_B.id,
  deleted_at: null,
  permissions: permissionNames.map((name, index) => ({
    permission: { id: index + 1, name, deleted_at: null },
  })),
});

describe('company role actions (ZIG-I3-5)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockActionAuthorized(mockRequireActionPermission);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('getCompanyRoles marks shared roles and counts members of the caller company', async () => {
    mockDb.query.role.findMany.mockResolvedValue([
      { ...ownRole(['tickets.read']), name: 'Admin' },
      { ...ownRole(['tickets.read']), id: 9, name: 'Global', company_id: null },
    ]);
    mockSelectRows([{ roleId: 7, value: 2 }]);
    mockCheckPermission.mockResolvedValue(true);

    const result = await getCompanyRoles();

    expect(mockRequireActionPermission).toHaveBeenCalledWith('roles.read');
    expect(result.data?.roles).toEqual([
      expect.objectContaining({ id: 7, isGlobal: false, isProtected: true, userCount: 2 }),
      expect.objectContaining({ id: 9, isGlobal: true, userCount: 0 }),
    ]);
    expect(result.data?.canWrite).toBe(true);
  });

  it('creates a role in the caller company from permission keys', async () => {
    mockSelectRows(catalog);
    mockCreateRole.mockResolvedValue({ success: true, data: { id: 12 } as never });

    const result = await saveCompanyRole({
      name: 'Técnico',
      permissionKeys: ['tickets.read', 'tickets.write'],
    });

    expect(result).toEqual({ success: true, data: { id: 12 } });
    expect(mockCreateRole).toHaveBeenCalledWith({
      name: 'Técnico',
      description: undefined,
      company_id: IDOR_COMPANY_B.id,
      permissions: [1, 2],
    });
  });

  it('keeps keys the role already had outside the matrix', async () => {
    mockDb.query.role.findFirst.mockResolvedValue(ownRole(['permissions.read', 'tickets.read']));
    mockSelectRows(catalog);
    mockUpdateRole.mockResolvedValue({ success: true, data: { id: 7 } as never });

    const result = await saveCompanyRole({
      id: 7,
      name: 'Operator',
      permissionKeys: ['permissions.read', 'tickets.read'],
    });

    expect(result.success).toBe(true);
    expect(mockUpdateRole).toHaveBeenCalledWith(7, expect.objectContaining({ permissions: [3, 1] }));
  });

  it('refuses keys outside the matrix that the role did not have', async () => {
    const result = await saveCompanyRole({
      name: 'Escalada',
      permissionKeys: ['companies.write'],
    });

    expect(result.success).toBe(false);
    expect(mockCreateRole).not.toHaveBeenCalled();
  });

  it.each([
    ['a shared global role', { ...ownRole([]), company_id: null }],
    ['another company role', { ...ownRole([]), company_id: IDOR_COMPANY_A.id }],
  ])('refuses to edit %s', async (_label, row) => {
    mockDb.query.role.findFirst.mockResolvedValue(row);

    const result = await saveCompanyRole({ id: 7, name: 'X', permissionKeys: [] });

    expect(result.success).toBe(false);
    expect(mockUpdateRole).not.toHaveBeenCalled();
  });

  it('refuses to delete another company role', async () => {
    mockDb.query.role.findFirst.mockResolvedValue({
      ...ownRole([]),
      company_id: IDOR_COMPANY_A.id,
    });

    const result = await deleteCompanyRole(7);

    expect(result.success).toBe(false);
    expect(mockDeleteRole).not.toHaveBeenCalled();
  });

  it('passes in-use refusals from deleteRole through', async () => {
    mockDb.query.role.findFirst.mockResolvedValue(ownRole([]));
    mockDeleteRole.mockResolvedValue({
      success: false,
      error: 'Cambia de rol a las personas… Código: RL005',
      errorType: 'validation',
    });

    const result = await deleteCompanyRole(7);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(result.error).toContain('RL005');
  });

  it.each([
    ['getCompanyRoles', () => getCompanyRoles()],
    ['saveCompanyRole', () => saveCompanyRole({ name: 'X', permissionKeys: [] })],
    ['deleteCompanyRole', () => deleteCompanyRole(7)],
  ])('%s fails closed without the permission', async (_name, call) => {
    mockActionPermissionDenied(mockRequireActionPermission);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockDb.query.role.findMany).not.toHaveBeenCalled();
    expect(mockCreateRole).not.toHaveBeenCalled();
    expect(mockDeleteRole).not.toHaveBeenCalled();
  });
});
