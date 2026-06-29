import { GET } from '@/app/api/companies/[id]/readiness/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { assessCompanyReadiness } from '@/lib/company-readiness';
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
jest.mock('@/lib/company-readiness', () => ({ assessCompanyReadiness: jest.fn() }));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockAssessCompanyReadiness = assessCompanyReadiness as jest.MockedFunction<
  typeof assessCompanyReadiness
>;

describe('cross-tenant IDOR - /api/companies/[id]/readiness', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies tenant B when targeting company A readiness', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(`http://localhost/api/companies/${IDOR_COMPANY_A.id}/readiness`),
      makeIdContext('id', String(IDOR_COMPANY_A.id)),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.read',
      IDOR_COMPANY_A.id,
    );
    expect(mockAssessCompanyReadiness).not.toHaveBeenCalled();
  });
});
