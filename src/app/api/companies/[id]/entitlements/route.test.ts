import { GET } from '@/app/api/companies/[id]/entitlements/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { getCompanyEntitlementUsage } from '@/lib/company-entitlement-usage';
import { IDOR_COMPANY_A, mockTenantBCrossTenantDenied, makeGetRequest, makeIdContext } from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/db', () => ({ db: { query: { company: { findFirst: jest.fn() } } } }));
jest.mock('@/lib/company-entitlement-usage', () => ({
  getCompanyEntitlementUsage: jest.fn(),
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockGetCompanyEntitlementUsage = getCompanyEntitlementUsage as jest.MockedFunction<
  typeof getCompanyEntitlementUsage
>;

describe('cross-tenant IDOR - /api/companies/[id]/entitlements', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies tenant B when targeting company A entitlements', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(`http://localhost/api/companies/${IDOR_COMPANY_A.id}/entitlements`),
      makeIdContext('id', String(IDOR_COMPANY_A.id)),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.read',
      IDOR_COMPANY_A.id,
    );
    expect(mockGetCompanyEntitlementUsage).not.toHaveBeenCalled();
  });
});
