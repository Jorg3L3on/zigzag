import { GET } from '@/app/api/companies/[id]/operator-summary/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { loadCompanyOperatorSummary } from '@/lib/company-operator-summary-loader';
import { IDOR_COMPANY_A, mockTenantBCrossTenantDenied, makeGetRequest, makeIdContext } from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/company-operator-summary-loader', () => ({
  loadCompanyOperatorSummary: jest.fn(),
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockLoadCompanyOperatorSummary = loadCompanyOperatorSummary as jest.MockedFunction<
  typeof loadCompanyOperatorSummary
>;

describe('cross-tenant IDOR - /api/companies/[id]/operator-summary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies tenant B when targeting company A operator summary', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/companies/${IDOR_COMPANY_A.id}/operator-summary`,
      ),
      makeIdContext('id', String(IDOR_COMPANY_A.id)),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.read',
      IDOR_COMPANY_A.id,
    );
    expect(mockLoadCompanyOperatorSummary).not.toHaveBeenCalled();
  });
});
