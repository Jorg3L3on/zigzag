import { DELETE, POST } from '@/app/api/companies/[id]/logo/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { IDOR_COMPANY_A, mockTenantBCrossTenantDenied, makeGetRequest, makeIdContext } from '@/test/cross-tenant-helpers';

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
    query: { user: { findFirst: jest.fn() }, company: { findFirst: jest.fn() } },
    update: jest.fn(),
  },
}));
jest.mock('@/lib/company-logo-upload', () => ({ parseCompanyLogoFile: jest.fn() }));
jest.mock('@/lib/company-logo-blob', () => ({
  uploadCompanyLogoBlob: jest.fn(),
  deleteCompanyLogoBlob: jest.fn(),
}));
jest.mock('@/lib/governance-audit', () => ({
  recordGovernanceAudit: jest.fn(),
  sessionUserToGovernanceActor: jest.fn(),
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as {
  update: jest.Mock;
  query: { user: { findFirst: jest.Mock }; company: { findFirst: jest.Mock } };
};

describe('cross-tenant IDOR - /api/companies/[id]/logo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST denies tenant B upload on company A', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await POST(
      makeGetRequest(`http://localhost/api/companies/${IDOR_COMPANY_A.id}/logo`),
      makeIdContext('id', String(IDOR_COMPANY_A.id)),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.write',
      IDOR_COMPANY_A.id,
    );
    expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('DELETE denies tenant B logo remove on company A', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await DELETE(
      makeGetRequest(`http://localhost/api/companies/${IDOR_COMPANY_A.id}/logo`),
      makeIdContext('id', String(IDOR_COMPANY_A.id)),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.write',
      IDOR_COMPANY_A.id,
    );
    expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
