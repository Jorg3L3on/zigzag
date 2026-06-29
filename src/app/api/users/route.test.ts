import { GET, POST } from '@/app/api/users/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  mockSelectChain,
  mockTenantBCrossTenantDenied,
  mockTenantBAllowed,
  makeGetRequest,
  makeJsonRequest,
} from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    query: { role: { findFirst: jest.fn() } },
  },
}));
jest.mock('@/lib/governance-audit', () => ({
  recordGovernanceAudit: jest.fn(),
  sanitizeUserForAudit: jest.fn((row) => row),
  sessionUserToGovernanceActor: jest.fn(() => ({ type: 'user', id: '201' })),
}));
jest.mock('@/lib/company-entitlement-guard', () => ({
  assertCompanyEntitlementAllows: jest.fn(),
  CompanyEntitlementExceededError: class extends Error {},
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'hashed-password') }));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  query: { role: { findFirst: jest.Mock } };
};

describe('cross-tenant IDOR — /api/users', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies Company B user in cross-tenant context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(makeGetRequest('http://localhost/api/users'));

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith('users.read');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('POST denies Company B user creating in Company A', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await POST(
      makeJsonRequest('http://localhost/api/users', {
        name: 'Foreign User',
        email: 'foreign@example.com',
        password: 'password123',
        company_id: IDOR_COMPANY_A.id,
      }),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'users.write',
      IDOR_COMPANY_A.id,
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('GET scopes list to authorized tenant company', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.select.mockReturnValue(mockSelectChain([]));

    await GET(makeGetRequest('http://localhost/api/users'));

    expect(mockDb.select).toHaveBeenCalled();
  });
});
